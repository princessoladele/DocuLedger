# DocuLedger

Production-ready document intelligence platform: upload PDFs, scanned forms,
invoices, receipts, and emails; DocuLedger runs them through an OCR +
schema-based extraction pipeline, validates the result, routes anything
uncertain to a human review queue, and anchors a tamper-evident fingerprint
of verified data on the Stellar network via a Soroban smart contract.

Built as a multi-tenant SaaS: every row is scoped to an organization, auth
supports both dashboard users (JWT) and machine clients (API keys), and the
OCR/validation/anchoring pipeline runs as horizontally-scalable background
workers behind Redis-backed queues.

## Why Stellar

DocuLedger never puts a document or its extracted fields on-chain. Once a
document's data is extracted and (if needed) human-verified, DocuLedger
computes a SHA-256 fingerprint of the *canonicalized structured data* and
anchors that fingerprint via the `attestation` Soroban contract
([contracts/soroban-attestation](contracts/soroban-attestation)). Anyone
holding the same data can recompute its hash and compare it against the
immutable on-chain record — proving the data hasn't been altered since
verification, without ever exposing the underlying document or PII. See
[docs/STELLAR.md](docs/STELLAR.md) for the full flow.

## Feature overview

- **Auth & multi-tenancy** — JWT (access + rotating refresh tokens) for
  dashboard users, API keys for programmatic access, every resource scoped
  to an `Organization`.
- **RBAC** — four roles (`MEMBER` → `REVIEWER` → `ADMIN` → `OWNER`), enforced
  by a shared permission matrix ([packages/shared/src/rbac.ts](packages/shared/src/rbac.ts))
  used identically by the API guards and the web app's UI gating.
- **Document pipeline** — upload → OCR (Tesseract, with a real embedded-text
  fast path for digital PDFs) → schema-based field extraction with
  per-field confidence scores → validation → auto-complete or route to
  manual review → Stellar anchoring. Full state machine in
  [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma) (`DocumentStatus`).
  See [docs/PIPELINE.md](docs/PIPELINE.md).
- **Configurable, industry-specific schemas** — five built-in templates
  (real estate leases, healthcare insurance claims, finance invoices,
  logistics bills of lading, compliance/KYC identity documents) in
  [packages/shared/src/industry-templates](packages/shared/src/industry-templates),
  plus an API/UI for organizations to define their own.
- **Confidence-gated review queue** — any required field missing, failing
  validation, or below its schema's confidence threshold routes the
  document to `NEEDS_REVIEW`; reviewers can correct fields inline before
  approving, which re-anchors the corrected data.
- **Retry & error handling** — BullMQ jobs retry with exponential backoff;
  jobs that exhaust retries move the document to `FAILED` and the job to a
  `DEAD_LETTER` state visible on the dashboard's error queue.
- **Audit log** — every mutating action (auth events, uploads, review
  decisions, schema/user/key changes) is recorded append-only per org.
- **Dashboard & API** — document counts by status, throughput charts,
  review queue depth, dead-letter count; full OpenAPI docs at `/docs` on
  the running API.
- **Security** — Helmet, per-org rate limiting, encrypted-at-rest object
  storage, hashed API keys/passwords, request IDs on every response.

## Monorepo layout

```
apps/
  api/      NestJS REST API (auth, documents, review, schemas, dashboard, audit log, Stellar verify)
  worker/   BullMQ workers: OCR + extraction + validation, then Stellar anchoring
  web/      Next.js dashboard (App Router, Tailwind)
packages/
  database/ Prisma schema + generated client, shared by api & worker
  shared/   Types, RBAC, industry schema templates, validation logic, fingerprinting — used by all three apps
  stellar/  AnchorService abstraction: MockAnchorService (default, no network) + SorobanAnchorService (real Testnet calls)
contracts/
  soroban-attestation/  The on-chain attestation contract (Rust/Soroban)
docs/       Architecture, pipeline, deployment, Stellar integration docs
infra/k8s/  Example Kubernetes manifests for production deployment
```

## Quickstart (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

This brings up Postgres, Redis, MinIO (S3-compatible storage), runs
migrations, and starts the API (`:4000`, Swagger docs at
`http://localhost:4000/docs`, versioned REST routes under `/v1/...`),
worker, and web dashboard (`:3000`). Run `pnpm db:seed` once (see below) to
load the five built-in industry schemas, then register an account at
`http://localhost:3000/register`.

By default `STELLAR_MODE=mock`, so anchoring works out of the box with an
in-memory chain simulator — no Stellar account or network access required.
To anchor for real on Testnet, see [docs/STELLAR.md](docs/STELLAR.md).

## Local development (without Docker)

Requires Node 20+, pnpm, a running Postgres + Redis + MinIO (or point
`STORAGE_*` at real S3), and the `tesseract` + `pdftoppm` CLIs installed
(`apt install tesseract-ocr poppler-utils` / `brew install tesseract poppler`).

```bash
pnpm install
cp .env.example .env
pnpm db:migrate   # applies Prisma migrations
pnpm db:generate  # regenerates the Prisma client after schema changes
pnpm db:seed      # seeds the five built-in industry schemas

pnpm dev:api      # http://localhost:4000  (Swagger UI at /docs)
pnpm dev:worker   # OCR/validation/anchoring workers
pnpm dev:web      # http://localhost:3000
```

## Tests

```bash
pnpm test          # unit tests across all packages/apps (Jest)
cd contracts/soroban-attestation && cargo test   # Soroban contract tests
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, multi-tenancy, and key decisions
- [docs/PIPELINE.md](docs/PIPELINE.md) — the document processing state machine in detail
- [docs/STELLAR.md](docs/STELLAR.md) — how and why anchoring works, mock vs. live Testnet
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Docker Compose and Kubernetes deployment
- [contracts/soroban-attestation/README.md](contracts/soroban-attestation/README.md) — the on-chain contract
- Live API reference: `GET /docs` on a running API instance (OpenAPI/Swagger)
