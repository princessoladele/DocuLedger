import { MockAnchorService } from "./mock-anchor.service";

describe("MockAnchorService", () => {
  it("anchors a fingerprint and returns a confirmed submission", async () => {
    const svc = new MockAnchorService();
    const result = await svc.anchor("a".repeat(64), "org-1");
    expect(result.status).toBe("CONFIRMED");
    expect(result.txHash).toHaveLength(64);
  });

  it("is idempotent: re-anchoring the same fingerprint returns the same tx hash", async () => {
    const svc = new MockAnchorService();
    const first = await svc.anchor("b".repeat(64), "org-1");
    const second = await svc.anchor("b".repeat(64), "org-1");
    expect(second.txHash).toEqual(first.txHash);
  });

  it("verify returns null for a fingerprint that was never anchored", async () => {
    const svc = new MockAnchorService();
    expect(await svc.verify("c".repeat(64))).toBeNull();
  });

  it("verify returns the anchoring org after anchor()", async () => {
    const svc = new MockAnchorService();
    await svc.anchor("d".repeat(64), "org-42");
    const record = await svc.verify("d".repeat(64));
    expect(record?.orgId).toEqual("org-42");
  });
});
