import { createHash } from "crypto";

/**
 * Deterministically canonicalizes a plain JSON-serializable value: object
 * keys are sorted recursively so the same logical data always serializes to
 * the same bytes regardless of key insertion order. This is what gets
 * hashed before anchoring, so the hash is stable across re-serialization.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 fingerprint (hex) of the canonicalized value. This is what gets anchored on-chain — never the raw document or PII. */
export function fingerprintOf(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

/** SHA-256 fingerprint (hex) of raw bytes, used for the stored document's integrity hash. */
export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
