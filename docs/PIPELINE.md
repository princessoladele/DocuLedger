# Document processing pipeline

## State machine

`Document.status` (see [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)):

```
UPLOADED → QUEUED → PROCESSING → VALIDATING ─┬─▶ NEEDS_REVIEW ─┬─▶ REVIEWED → ANCHORED
                                              │                 └─▶ FAILED (rejected)
                                              └─▶ REVIEWED (auto, no issues) → ANCHORED

Any stage → FAILED, if its job exhausts all retries (see "Retries" below)
FAILED → QUEUED, via POST /documents/:id/retry
```

## Stages

1. **Upload** (`apps/api` `DocumentsController`/`DocumentsService`)
   - Validates size (`MAX_UPLOAD_BYTES`, 25MB) and MIME type.
   - Computes `sha256` of the raw bytes (stored on `Document.sha256` — this
     is a plain integrity hash of the *file*, separate from the on-chain
     *data* fingerprint computed later).
   - Streams the file to object storage, creates the `Document` row
     (`UPLOADED` → `QUEUED`), creates a `ProcessingJob` row, and enqueues a
     BullMQ job on the `ocr-extraction` queue.
   - Records an `AuditLog` entry (`document.upload`).

2. **OCR + extraction + validation** (`apps/worker`
   `processors/extraction.processor.ts`, one job, three steps):
   - `PROCESSING`: `OcrService.extract()` picks a strategy by MIME type —
     images go straight to `tesseract`; PDFs try their embedded text layer
     first (`pdf-parse`) and only rasterize+OCR (`pdftoppm` + `tesseract`)
     pages when there's no usable text layer (i.e. a scanned PDF); `.eml`
     files are parsed with `mailparser`. Tesseract's own TSV output is
     parsed for real per-word confidence scores — nothing here is a
     made-up number.
   - `VALIDATING`: if the document has a schema, `FieldExtractor` matches
     each field's aliases against the OCR'd text and `validateExtraction`
     (in `packages/shared`, shared with the API and its own unit tests)
     checks required fields, types, regex patterns, enum membership, and
     per-field confidence against the schema's threshold.
   - Persists one `ExtractionResult` (full field list + overall
     confidence) and any `ValidationIssue` rows.
   - **Routing**: any `ERROR`-severity issue (missing required field,
     failed pattern/type/enum check) or any field below its confidence
     threshold → `NEEDS_REVIEW` + a `ReviewTask` row. Otherwise →
     `REVIEWED`, and an anchor job is enqueued immediately.

3. **Human review** (optional; `apps/api` `ReviewController`/`ReviewService`,
   REVIEWER role or above):
   - Reviewer sees each field's extracted value, confidence, and any
     validation message, and can overwrite values inline.
   - **Approve**: merges corrected values into the `ExtractionResult`,
     moves the document to `REVIEWED`, and enqueues the anchor job — so
     what gets anchored is always the *final*, human-confirmed data.
   - **Reject**: moves the document to `FAILED` with the reviewer's notes
     as `failureReason`. (A future iteration could route rejections back
     to `QUEUED` for re-extraction with adjusted parameters instead of a
     terminal failure — see the "Future work" note in ARCHITECTURE.md.)

4. **Anchoring** (`apps/worker` `processors/anchor.processor.ts`):
   - Fingerprints `{ documentId, fields }` from the *latest* (i.e.
     post-review) `ExtractionResult` — `fingerprintOf()` in
     `packages/shared` canonicalizes key order first, so the hash is
     stable regardless of serialization order.
   - Calls `AnchorService.anchor(fingerprint, organizationId)` (mock or
     real Soroban, see [STELLAR.md](STELLAR.md)), persists an
     `AnchorRecord`, and moves the document to `ANCHORED` on success.

## Retries & the error queue

Every BullMQ job (`ocr-extraction`, `anchoring`) is configured with 5
attempts and exponential backoff (`RETRY_BACKOFF_BASE_MS * 2^(n-1)`). Each
attempt updates a `ProcessingJob` row so the dashboard has a durable record
independent of Redis. When a job's final attempt fails, `apps/worker`'s
`onJobFailed` handler (in `main.ts`) moves:

- the `Document` to `FAILED` with `failureReason` set to the last error, and
- the corresponding `ProcessingJob` to `DEAD_LETTER`.

`GET /dashboard/summary` surfaces `deadLetterCount` and the `FAILED` bucket
directly; `POST /documents/:id/retry` re-enqueues a fresh job for any
`FAILED` document (resets `ProcessingJob`, clears `failureReason`).

## Confidence scoring

Two confidence numbers exist, both surfaced in the review UI:

- **Per-field confidence** — `FieldExtractor` scores each match by how it
  was found (an exact `"Label: value"` line match starts at 0.95, a looser
  same-line match at 0.75, discounted slightly per alias fallback used),
  then multiplies by the OCR engine's own confidence for that page/word
  region. A digital PDF's text layer always OCR-confidences at 1.0 (no
  recognition uncertainty at all), so field confidence there is purely a
  function of how well the alias matched.
- **Schema confidence threshold** — each `DocumentSchema` has a
  `confidenceThreshold` (default 0.85, overridable per field via
  `minConfidence`); any field extracted below its threshold is flagged
  `LOW_CONFIDENCE` and forces the document into review even if every
  other check passed.
