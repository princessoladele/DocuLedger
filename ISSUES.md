# Scoped issues

A working backlog of sprint-sized issues for contributors, grouped by type.
Each entry names the files most likely involved and what "done" looks
like. Pick one, open a PR against `main`, and reference the issue.

Anything not listed here is still fair game — open an issue proposing it
first so scope stays sprint-sized.

## Bug fixes

### Route rejected reviews back into re-extraction instead of terminal `FAILED`
- **Files:** `apps/api/src/modules/review/review.service.ts`,
  `packages/database/prisma/schema.prisma` (`DocumentStatus`)
- **Problem:** `reject()` currently moves a document straight to `FAILED`
  with no path back. A reviewer rejecting bad extraction should be able to
  send it back for re-processing (possibly against a different schema or
  with a flag to force manual-only handling), not dead-end it.
- **Done when:** a rejected document can be re-queued via the existing
  `/documents/:id/retry` endpoint or a new explicit action, and the
  `ReviewTask`/`AuditLog` trail makes the history reconstructable.

### Redis-backed rate limiting
- **Files:** `apps/api/src/app.module.ts` (`ThrottlerModule.forRootAsync`)
- **Problem:** the default `@nestjs/throttler` storage is in-memory per
  process, so limits reset per replica — fine for one instance, wrong once
  the API is horizontally scaled.
- **Done when:** throttler storage is backed by the existing Redis
  connection (e.g. `@nest-lab/throttler-storage-redis`), configurable via
  env, with a note in `docs/DEPLOYMENT.md`.

### Prune expired refresh tokens
- **Files:** `apps/api/src/modules/auth/auth.service.ts`,
  `packages/database/prisma/schema.prisma` (`RefreshToken`)
- **Problem:** revoked/expired `RefreshToken` rows accumulate forever.
- **Done when:** there's a scheduled cleanup (a worker cron job, or a
  `DELETE ... WHERE expiresAt < now()` run on a schedule) and it's
  documented.

## New features

### Webhook delivery
- **Files:** new `apps/api/src/modules/webhooks/`,
  `packages/database/prisma/schema.prisma` (`Webhook` model already exists)
- **Problem:** the `Webhook` model and the `webhook:manage` permission
  exist, but nothing ever calls one. Organizations can't get notified of
  `document.needs_review`, `document.anchored`, etc.
- **Done when:** a webhook module CRUDs `Webhook` rows (create/list/revoke,
  mirroring `apps/api/src/modules/api-keys`), a delivery mechanism (a
  BullMQ job fired from the relevant state transitions in
  `apps/worker/src/processors/`) POSTs an HMAC-signed (`Webhook.secret`)
  JSON payload, and failed deliveries retry with backoff like every other
  queue in this codebase.

### MFA enrollment and verification
- **Files:** `apps/api/src/modules/auth/`,
  `packages/database/prisma/schema.prisma` (`User.mfaSecret` already exists)
- **Problem:** the schema reserves a field for it; nothing implements it.
- **Done when:** a user can enroll a TOTP authenticator, `login()` requires
  a second factor when enabled, and there's a recovery-code or disable
  flow.

### Additional OCR engine adapters
- **Files:** `apps/worker/src/ocr/ocr.service.ts` (implement the same
  `{text, confidence, engine}` contract)
- **Problem:** Tesseract is solid for a self-hosted default but a
  production deployment may want higher accuracy from AWS Textract or
  Google Document AI.
- **Done when:** at least one additional adapter exists, selectable via
  env var, with unit tests using recorded/mocked API responses (no live
  cloud credentials required to run the test suite).

### Batch / Merkle-root anchoring
- **Files:** `apps/worker/src/processors/anchor.processor.ts`,
  `contracts/soroban-attestation/src/lib.rs`,
  `packages/database/prisma/schema.prisma` (`AnchorRecord`)
- **Problem:** today it's one Stellar transaction per anchored document —
  fine at low volume, costly at scale.
- **Done when:** there's a batching mode that accumulates fingerprints
  over a configurable window, anchors a single Merkle root, and
  `GET /stellar/verify/:documentId` can still prove an individual
  document's inclusion (Merkle proof) against that root. See
  `docs/STELLAR.md` "Moving to Mainnet" for the intended shape.

### Visual schema builder
- **Files:** `apps/web/src/app/(app)/settings/schemas/`,
  `apps/api/src/modules/schemas/`
- **Problem:** custom schemas are authored as raw JSON
  (`FieldDefinition[]`, see `packages/shared/src/schema-types.ts`) via the
  API today — fine for engineers, not for the ops/compliance people who'd
  actually own a schema.
- **Done when:** the dashboard has a field editor (add/remove/reorder
  fields, set type/aliases/required/pattern) that calls the existing
  `POST/PATCH /schemas` endpoints — no new API surface needed.

### New industry schema templates
- **Files:** `packages/shared/src/industry-templates/`
- **Problem:** only five built-ins exist (real estate, healthcare,
  finance, logistics, compliance).
- **Done when:** a new template follows the existing pattern (see
  `finance.ts` for a good reference), is added to
  `BUILT_IN_SCHEMA_TEMPLATES`, seeded via `pnpm db:seed`, and has a
  corresponding entry in `docs/PIPELINE.md`'s schema list if that section
  gets extended.

### Inbound email ingestion
- **Files:** new ingestion entrypoint (e.g. an SES/inbound-webhook
  receiver, or an IMAP poller) that lands in the same upload path as
  `apps/api/src/modules/documents/documents.service.ts`; OCR-side `.eml`
  parsing already exists in `apps/worker/src/ocr/ocr.service.ts`
- **Problem:** `DocumentSource.EMAIL` exists as an enum value and the OCR
  layer already handles `.eml` files, but nothing feeds an email in from
  the outside — only direct upload and the API key path exist today.
- **Done when:** an org can get a dedicated inbound address (or configure
  an inbox), and mail landing there creates a `Document` the same way an
  upload does, attributed correctly (`source: "EMAIL"`).

## Documentation

### CONTRIBUTING.md and LICENSE
- **Problem:** neither file exists yet.
- **Done when:** `CONTRIBUTING.md` covers local setup (already mostly in
  `README.md` — consolidate/link rather than duplicate), branch/PR
  conventions, and how to run the test suite; `LICENSE` reflects
  whatever license the maintainers choose.

### Per-industry quickstart guides
- **Files:** new `docs/guides/`
- **Done when:** at least one guide (e.g. "extract a lease agreement
  end-to-end") walks through upload → review → anchor → verify using the
  real API, screenshots or `curl` transcripts included.

### Walkthrough recording
- **Done when:** a short screen recording (linked from `README.md`) shows
  the review queue and the Stellar verification flow in the dashboard.

## Testing

### API end-to-end test suite
- **Files:** `apps/api/test/*.e2e-spec.ts` (directory doesn't exist yet;
  `apps/api/jest.e2e.config.js` is already wired up and waiting)
- **Problem:** unit tests cover `AuthService`, `RolesGuard`, and
  `DocumentsService`'s ownership logic (see `apps/api/src/**/*.spec.ts`),
  but there's no test that boots the full Nest app against a real
  (containerized) Postgres/Redis and drives it through HTTP with
  `supertest`.
- **Done when:** at minimum, register → login → upload → list → get
  round-trips through real HTTP, and an RBAC-denial case is covered
  end-to-end (not just at the guard-unit level).

### Web app tests
- **Files:** `apps/web/`
- **Problem:** zero UI test coverage today.
- **Done when:** component/interaction tests (Playwright or React Testing
  Library — maintainer's call) exist for at least the upload flow and the
  review-approval flow.

### OCR queue load testing
- **Files:** `apps/worker/`
- **Problem:** no data on throughput/latency under concurrent uploads.
- **Done when:** a load-testing script (k6, Artillery, or a plain Node
  script) documents observed jobs/sec at a given `WORKER_CONCURRENCY` and
  CPU allocation, written up in `docs/DEPLOYMENT.md`'s scaling notes.
