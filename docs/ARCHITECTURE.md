# Architecture

## Services

```
                         ┌──────────────┐
                         │   web (Next) │  dashboard UI, talks only to the API
                         └──────┬───────┘
                                │ HTTPS (JWT / API key)
                                ▼
┌───────────┐   enqueue   ┌──────────┐   BullMQ jobs   ┌───────────┐
│  clients  │────────────▶│   api    │────────────────▶│  worker   │
│ (S2S/API) │             │ (NestJS) │◀────────────────│ (BullMQ)  │
└───────────┘             └────┬─────┘   status writes └─────┬─────┘
                                │                              │
                     ┌──────────┴──────────┐         ┌─────────┴─────────┐
                     ▼                     ▼         ▼                   ▼
                 Postgres            S3 / MinIO   tesseract/pdftoppm   Stellar
                (Prisma)            (documents)    (OCR, local)     (Soroban RPC)
```

- **api** — all synchronous request/response work: auth, document upload
  (streams straight to object storage), CRUD for schemas/users/API
  keys/webhooks, the dashboard summary endpoint, and the review-decision
  endpoints. Never does OCR itself — it only enqueues a job and returns.
- **worker** — all asynchronous, potentially slow or flaky work: OCR,
  field extraction, validation, and Stellar anchoring. Horizontally
  scalable (`WORKER_CONCURRENCY`, or run more replicas) since state lives
  in Postgres/Redis, not in-process.
- **web** — a thin client; it holds no business logic beyond RBAC-based UI
  gating (which mirrors, but does not replace, the API's own enforcement).

## Multi-tenancy

Every domain table carries `organizationId` (see
[packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)).
There is no shared-schema-per-tenant or database-per-tenant split — a
single Postgres schema with an `organizationId` column on every query,
enforced at the application layer:

- `AuthGuard` resolves the caller (JWT or API key) to a `principal` with an
  `organizationId`, attached to `request.principal`.
- Every service method takes that `organizationId` (or the whole
  `principal`) and includes it in every Prisma `where` clause — there is no
  query in the codebase that fetches a domain row without an org filter.
- `DocumentSchema` rows with `organizationId: null` are the built-in,
  cross-tenant industry templates; every other row's `organizationId` is
  mandatory and non-null at the schema level.

This is the right trade-off for the current scale (one Postgres instance
comfortably serves many orgs with proper indexing — see the `@@index`
declarations keyed by `organizationId`); a true database-per-tenant split
is a mechanical migration away if a specific customer ever needs the
isolation, without changing any application code above the Prisma layer.

## AuthN/AuthZ

- **Users** authenticate with email/password (bcrypt, cost 12) and receive
  a short-lived JWT access token plus a rotating refresh token (hashed at
  rest; each refresh revokes the presented token and issues a new one, so
  a leaked refresh token has a bounded blast radius).
- **API keys** are `sha256`-hashed at rest; only the prefix is stored in
  the clear for identification in the UI. The raw key is shown exactly
  once, at creation time.
- **RBAC**: four roles, `MEMBER < REVIEWER < ADMIN < OWNER`. Two
  enforcement primitives, both backed by the same table in
  [packages/shared/src/rbac.ts](../packages/shared/src/rbac.ts):
  - `@MinRole("ADMIN")` — caller's role rank must be ≥ the given role.
  - `@RequirePermissions("document:upload", ...)` — caller's role must
    hold every listed permission (permissions are additive per role tier).
  Both decorators are read by a single `RolesGuard`; `AuthGuard` runs
  first and populates `request.principal`, so `RolesGuard` never has to
  know about JWTs or API keys.

## Data protection

- Documents are stored in S3/MinIO with server-side encryption
  (`ServerSideEncryption: AES256` on every `PutObject`), never on the
  application servers' disks.
- Downloads go through short-lived (5 min) presigned URLs — the API never
  proxies file bytes itself.
- Only a SHA-256 fingerprint of *extracted, structured* data — never the
  raw document, and never anything before validation/review — is what
  reaches the Stellar network. See [STELLAR.md](STELLAR.md).
- Passwords: bcrypt. API keys / refresh tokens: sha256 at rest, compared
  in constant time by the hash lookup itself (equality on a hash, not a
  timing-sensitive raw secret comparison).

## Rate limiting & abuse resistance

`@nestjs/throttler` applies a global per-IP limit (`RATE_LIMIT_MAX` per
`RATE_LIMIT_TTL_SECONDS`, defaults 120/min) ahead of authentication, so
even unauthenticated brute-force attempts against `/auth/login` are capped
before they reach the database. Swap in a Redis-backed throttler storage
(`@nest-lab/throttler-storage-redis` or similar) once running more than one
API replica, since the default storage is in-memory per instance.

## Observability

- Structured JSON logs (`pino` in the worker; Nest's own logger, wired to
  emit through the same filter, in the API) with a request ID attached to
  every HTTP response (`x-request-id`) and log line.
- `/health` (liveness+readiness, checks Postgres connectivity) and
  `/health/live` (pure liveness) for orchestrator probes.
- The `ProcessingJob` table is a durable, queryable record of every queue
  attempt — independent of BullMQ/Redis retention — so the dashboard's
  error-queue view survives Redis eviction and gives a real audit trail of
  retries, not just "it failed once, somewhere."

## Extensibility points (by design)

- **OCR engine**: `OcrService.extract()` in `apps/worker/src/ocr` is the
  only place that knows about Tesseract/`pdftoppm`; swapping in AWS
  Textract or Google Document AI means implementing the same
  `{text, confidence, engine}` contract there.
- **Field extraction**: `FieldExtractor` in `apps/worker/src/extraction` is
  a deliberately simple, auditable alias-matching heuristic. A
  layout-aware ML model or an LLM-based extractor can replace it without
  touching validation, review routing, or anchoring — they all consume the
  same `ExtractedField[]` shape.
- **Anchoring**: `AnchorService` in `packages/stellar` has exactly two
  implementations (`MockAnchorService`, `SorobanAnchorService`), selected
  by `STELLAR_MODE`. Nothing outside `packages/stellar` imports the
  Stellar SDK directly.
- **Schemas**: entirely data-driven (`DocumentSchema.fields` JSON), so new
  industries or document types are a database row, not a code change.
