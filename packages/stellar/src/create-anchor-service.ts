import { Networks } from "@stellar/stellar-sdk";
import { AnchorService } from "./anchor-service.interface";
import { MockAnchorService } from "./mock-anchor.service";
import { RedisMockAnchorService } from "./redis-mock-anchor.service";
import { SorobanAnchorService } from "./soroban-anchor.service";

export interface AnchorServiceEnv {
  STELLAR_MODE?: string; // "mock" | "soroban"
  STELLAR_RPC_URL?: string;
  STELLAR_NETWORK_PASSPHRASE?: string;
  STELLAR_CONTRACT_ID?: string;
  STELLAR_OPERATOR_SECRET?: string;
  STELLAR_NETWORK_LABEL?: string;
  /** When set, "mock" mode stores anchors in Redis instead of in-process memory, so `anchor()` from the worker and `verify()` from the API see the same data. */
  REDIS_URL?: string;
}

/**
 * Builds the AnchorService the rest of the app depends on, purely from env
 * vars — this is the single place that decides mock vs. real Soroban so
 * apps/api and apps/worker stay in sync without duplicating the branch.
 *
 * Defaults to "mock" so local dev and CI never require network access or a
 * funded Stellar account; set STELLAR_MODE=soroban with the vars below to
 * anchor for real on Testnet.
 */
export function createAnchorServiceFromEnv(env: AnchorServiceEnv = process.env): AnchorService {
  const mode = env.STELLAR_MODE ?? "mock";

  if (mode === "mock") {
    return env.REDIS_URL ? new RedisMockAnchorService(env.REDIS_URL) : new MockAnchorService();
  }

  if (mode === "soroban") {
    const { STELLAR_RPC_URL, STELLAR_CONTRACT_ID, STELLAR_OPERATOR_SECRET } = env;
    if (!STELLAR_RPC_URL || !STELLAR_CONTRACT_ID || !STELLAR_OPERATOR_SECRET) {
      throw new Error(
        "STELLAR_MODE=soroban requires STELLAR_RPC_URL, STELLAR_CONTRACT_ID and STELLAR_OPERATOR_SECRET",
      );
    }
    return new SorobanAnchorService({
      rpcUrl: STELLAR_RPC_URL,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET,
      contractId: STELLAR_CONTRACT_ID,
      sourceSecretKey: STELLAR_OPERATOR_SECRET,
      network: env.STELLAR_NETWORK_LABEL ?? "testnet",
    });
  }

  throw new Error(`Unknown STELLAR_MODE "${mode}" — expected "mock" or "soroban"`);
}
