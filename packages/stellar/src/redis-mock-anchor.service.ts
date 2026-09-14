import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";
import { AnchorRecordLookup, AnchorService, AnchorSubmission } from "./anchor-service.interface";

/**
 * Same deterministic, no-Stellar-network mock semantics as
 * `MockAnchorService`, but backed by Redis instead of an in-process Map.
 *
 * This matters because the API and worker are separate Node processes:
 * the worker is what calls `anchor()`, while the API's
 * `GET /stellar/verify/:id` calls `verify()` — with a plain in-memory
 * `MockAnchorService`, each process has its own empty store and
 * verification can never succeed. Since both processes already depend on
 * Redis (for BullMQ), using it here too keeps `STELLAR_MODE=mock` genuinely
 * usable end-to-end without requiring a real Stellar account, while
 * `MockAnchorService` itself stays a dependency-free, pure-unit-test double.
 */
export class RedisMockAnchorService implements AnchorService {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { lazyConnect: false });
  }

  private key(fingerprint: string): string {
    return `doculedger:mock-anchor:${fingerprint}`;
  }

  async anchor(fingerprint: string, orgId: string): Promise<AnchorSubmission> {
    const existing = await this.verify(fingerprint);
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
    await this.redis.set(this.key(fingerprint), JSON.stringify(record));

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
    const raw = await this.redis.get(this.key(fingerprint));
    return raw ? (JSON.parse(raw) as AnchorRecordLookup) : null;
  }

  /** Closes the underlying Redis connection. Call on process shutdown / in test teardown. */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
