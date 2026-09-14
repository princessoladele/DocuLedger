export const QUEUE_NAMES = {
  OCR_EXTRACTION: "ocr-extraction",
  VALIDATION: "validation",
  ANCHORING: "anchoring",
} as const;

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;

/** Default max attempts before a job is moved to the dead-letter/error queue. */
export const DEFAULT_MAX_ATTEMPTS = 5;

/** Backoff base (ms) for exponential retry: attempt N waits BASE * 2^(N-1). */
export const RETRY_BACKOFF_BASE_MS = 2_000;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "message/rfc822", // .eml
] as const;

export const STELLAR_NETWORKS = {
  TESTNET: "testnet",
  FUTURENET: "futurenet",
  PUBLIC: "public",
} as const;
