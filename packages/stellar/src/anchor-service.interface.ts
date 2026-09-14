/**
 * Abstraction over "put a tamper-evident fingerprint on Stellar". Nothing
 * about a document's content, extracted fields, or any PII ever crosses
 * this boundary — only a SHA-256 fingerprint (see @doculedger/shared's
 * `fingerprintOf`) and an opaque organization id.
 *
 * Two implementations exist:
 *  - SorobanAnchorService: invokes the real `attestation` Soroban contract
 *    on Stellar Testnet (see contracts/soroban-attestation).
 *  - MockAnchorService: deterministic in-memory implementation used in unit
 *    tests and local dev when STELLAR_MODE=mock (no network required).
 *
 * Which one is wired up is decided in apps/worker/src/stellar/stellar.module
 * by the STELLAR_MODE env var, so the rest of the app never branches on it.
 */
export interface AnchorSubmission {
  fingerprint: string;
  network: string;
  contractId: string | null;
  txHash: string;
  ledgerSequence: number | null;
  status: "SUBMITTED" | "CONFIRMED" | "FAILED";
  errorMessage?: string;
}

export interface AnchorRecordLookup {
  fingerprint: string;
  orgId: string;
  submittedAtUnix: number;
  txHash: string;
}

export interface AnchorService {
  /**
   * Anchors a fingerprint on-chain, associated with the submitting
   * organization. Idempotent: re-submitting the same fingerprint for the
   * same org returns the existing record rather than writing a duplicate.
   */
  anchor(fingerprint: string, orgId: string): Promise<AnchorSubmission>;

  /**
   * Looks up a previously anchored fingerprint to verify it (and therefore
   * the underlying extracted data, since the fingerprint is a hash of it)
   * has not been tampered with since anchoring.
   */
  verify(fingerprint: string): Promise<AnchorRecordLookup | null>;
}
