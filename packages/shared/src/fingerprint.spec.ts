import { canonicalize, fingerprintOf } from "./fingerprint";

describe("fingerprint", () => {
  it("canonicalizes key order so equivalent objects serialize identically", () => {
    const a = { b: 2, a: 1, nested: { z: 1, y: 2 } };
    const b = { a: 1, nested: { y: 2, z: 1 }, b: 2 };
    expect(canonicalize(a)).toEqual(canonicalize(b));
  });

  it("produces identical fingerprints for logically equal data regardless of key order", () => {
    const a = { documentId: "doc-1", fields: { total: "100.00", vendor: "Acme" } };
    const b = { fields: { vendor: "Acme", total: "100.00" }, documentId: "doc-1" };
    expect(fingerprintOf(a)).toEqual(fingerprintOf(b));
  });

  it("produces different fingerprints when the underlying data differs", () => {
    const a = fingerprintOf({ total: "100.00" });
    const b = fingerprintOf({ total: "100.01" });
    expect(a).not.toEqual(b);
  });

  it("returns a 64-char hex sha256 digest", () => {
    const hash = fingerprintOf({ x: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
