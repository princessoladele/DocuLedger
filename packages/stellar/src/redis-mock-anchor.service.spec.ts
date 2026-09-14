import { RedisMockAnchorService } from "./redis-mock-anchor.service";

// Integration-style test: exercises real Redis rather than mocking ioredis,
// since the whole point of this class is cross-process consistency via a
// real shared store. Skipped automatically when no Redis is reachable
// (e.g. a sandboxed CI runner without REDIS_URL) rather than failing the
// suite — set REDIS_URL to run it for real.
const REDIS_URL = process.env.REDIS_URL;
const describeIfRedis = REDIS_URL ? describe : describe.skip;

describeIfRedis("RedisMockAnchorService", () => {
  const svc = new RedisMockAnchorService(REDIS_URL as string);
  const instances = [svc];

  afterAll(async () => {
    await Promise.all(instances.map((i) => i.disconnect()));
  });

  it("anchors a fingerprint and returns a confirmed submission", async () => {
    const fp = `test-${Date.now()}-a`;
    const result = await svc.anchor(fp, "org-1");
    expect(result.status).toBe("CONFIRMED");
    expect(result.txHash).toHaveLength(64);
  });

  it("is visible to a second instance (simulating a different process)", async () => {
    const fp = `test-${Date.now()}-b`;
    const writer = new RedisMockAnchorService(REDIS_URL as string);
    const reader = new RedisMockAnchorService(REDIS_URL as string);
    instances.push(writer, reader);

    const submitted = await writer.anchor(fp, "org-2");
    const verified = await reader.verify(fp);

    expect(verified).not.toBeNull();
    expect(verified?.txHash).toEqual(submitted.txHash);
    expect(verified?.orgId).toEqual("org-2");
  });

  it("verify returns null for a fingerprint that was never anchored", async () => {
    const result = await svc.verify(`never-anchored-${Date.now()}`);
    expect(result).toBeNull();
  });
});
