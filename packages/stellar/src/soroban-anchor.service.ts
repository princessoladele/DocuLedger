import {
  Keypair,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { AnchorRecordLookup, AnchorService, AnchorSubmission } from "./anchor-service.interface";

export interface SorobanAnchorConfig {
  /** Soroban RPC endpoint, e.g. https://soroban-testnet.stellar.org */
  rpcUrl: string;
  /** e.g. Networks.TESTNET */
  networkPassphrase: string;
  /** Deployed `attestation` contract id (see contracts/soroban-attestation). */
  contractId: string;
  /** Secret key of the funded account that submits anchor transactions. */
  sourceSecretKey: string;
  network: string; // human label persisted alongside records, e.g. "testnet"
  /** How many ledgers to poll for transaction confirmation before giving up. */
  confirmationTimeoutMs?: number;
}

/**
 * Anchors document fingerprints on Stellar by invoking the `attestation`
 * Soroban contract (contracts/soroban-attestation). Each call:
 *   1. Loads the source account and simulates the invocation to get exact
 *      footprint/fees (`prepareTransaction`).
 *   2. Signs and submits.
 *   3. Polls `getTransaction` until the ledger confirms or times out.
 *
 * The contract itself is the source of truth for "has this fingerprint been
 * anchored" — `verify()` performs a free, non-mutating simulated call
 * (`get_record`) rather than trusting our own database, so verification
 * survives even if DocuLedger's own records were altered.
 */
export class SorobanAnchorService implements AnchorService {
  private readonly server: SorobanRpc.Server;
  private readonly contract: Contract;
  private readonly keypair: Keypair;

  constructor(private readonly config: SorobanAnchorConfig) {
    this.server = new SorobanRpc.Server(config.rpcUrl);
    this.contract = new Contract(config.contractId);
    this.keypair = Keypair.fromSecret(config.sourceSecretKey);
  }

  async anchor(fingerprint: string, orgId: string): Promise<AnchorSubmission> {
    try {
      const existing = await this.verify(fingerprint);
      if (existing) {
        return {
          fingerprint,
          network: this.config.network,
          contractId: this.config.contractId,
          txHash: existing.txHash,
          ledgerSequence: null,
          status: "CONFIRMED",
        };
      }

      const account = await this.server.getAccount(this.keypair.publicKey());
      const hashBytes = Buffer.from(fingerprint, "hex");
      if (hashBytes.length !== 32) {
        throw new Error(`fingerprint must be a 32-byte sha256 hex digest, got ${hashBytes.length} bytes`);
      }

      const op = this.contract.call(
        "anchor",
        nativeToScVal(hashBytes, { type: "bytes" }),
        nativeToScVal(orgId, { type: "string" }),
        nativeToScVal(this.keypair.publicKey(), { type: "address" }),
      );

      let tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(60)
        .build();

      const prepared = await this.server.prepareTransaction(tx);
      prepared.sign(this.keypair);

      const sendResult = await this.server.sendTransaction(prepared);
      if (sendResult.status === "ERROR") {
        return {
          fingerprint,
          network: this.config.network,
          contractId: this.config.contractId,
          txHash: sendResult.hash,
          ledgerSequence: null,
          status: "FAILED",
          errorMessage: JSON.stringify(sendResult.errorResult),
        };
      }

      const confirmation = await this.pollForConfirmation(sendResult.hash);
      return confirmation;
    } catch (err) {
      return {
        fingerprint,
        network: this.config.network,
        contractId: this.config.contractId,
        txHash: "",
        ledgerSequence: null,
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async verify(fingerprint: string): Promise<AnchorRecordLookup | null> {
    const hashBytes = Buffer.from(fingerprint, "hex");
    const account = await this.server.getAccount(this.keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call("get_record", nativeToScVal(hashBytes, { type: "bytes" })))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      return null;
    }
    if (!sim.result?.retval) {
      return null;
    }

    const native = scValToNative(sim.result.retval) as
      | { org_id: string; timestamp: bigint | number; submitter: string }
      | null;

    if (!native) return null;

    return {
      fingerprint,
      orgId: native.org_id,
      submittedAtUnix: Number(native.timestamp),
      txHash: "", // the contract doesn't store its own anchoring tx hash; we track that in our DB
    };
  }

  private async pollForConfirmation(hash: string): Promise<AnchorSubmission> {
    const timeoutMs = this.config.confirmationTimeoutMs ?? 30_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const result = await this.server.getTransaction(hash);
      if (result.status === "SUCCESS") {
        return {
          fingerprint: "",
          network: this.config.network,
          contractId: this.config.contractId,
          txHash: hash,
          ledgerSequence: result.ledger ?? null,
          status: "CONFIRMED",
        };
      }
      if (result.status === "FAILED") {
        return {
          fingerprint: "",
          network: this.config.network,
          contractId: this.config.contractId,
          txHash: hash,
          ledgerSequence: null,
          status: "FAILED",
          errorMessage: "Soroban transaction failed on-chain",
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    return {
      fingerprint: "",
      network: this.config.network,
      contractId: this.config.contractId,
      txHash: hash,
      ledgerSequence: null,
      status: "SUBMITTED", // still pending; caller/worker should re-poll later
      errorMessage: "Timed out waiting for confirmation; transaction may still confirm later",
    };
  }
}
