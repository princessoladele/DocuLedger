import { createHash, randomBytes } from "crypto";
import { AnchorRecordLookup, AnchorService, AnchorSubmission } from "./anchor-service.interface";

/**
 * In-memory AnchorService for local dev and CI, where outbound network
 * access to Horizon/Soroban RPC may not be available or desired. Produces
 * a deterministic, well-formed-looking (but not real) transaction hash so
 * downstream code paths (persistence, UI rendering) exercise realistic
 * shapes end-to-end without touching the network.
 */
export class MockAnchorService implements AnchorService {
  private readonly store = new Map<string, AnchorRecordLookup>();

  async anchor(fingerprint: string, orgId: string): Promise<AnchorSubmission> {
    const existing = this.store.get(fingerprint);
    if (existing) {
      return {
        fingerprint,
        network: "mock",
        contractId: "MOCK_CONTRACT",
        txHash: existing.txHash,
        ledgerSequence: 1,
        status: "CONFIRMED",
      };
    }

    const txHash = createHash("sha256")
      .update(fingerprint + orgId + randomBytes(8).toString("hex"))
      .digest("hex");

    const record: AnchorRecordLookup = {
      fingerprint,
      orgId,
      submittedAtUnix: Math.floor(Date.now() / 1000),
      txHash,
    };
    this.store.set(fingerprint, record);

    return {
      fingerprint,
      network: "mock",
      contractId: "MOCK_CONTRACT",
      txHash,
      ledgerSequence: 1,
      status: "CONFIRMED",
    };
  }

  async verify(fingerprint: string): Promise<AnchorRecordLookup | null> {
    return this.store.get(fingerprint) ?? null;
  }
}
