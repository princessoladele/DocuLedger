# Deployment

## Docker Compose (single-host / staging)

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec api pnpm --filter @doculedger/database seed   # once, to load built-in schemas
```

Services: `postgres`, `redis`, `minio` (+`minio-init` to create the
bucket), `migrate` (runs `prisma migrate deploy` once and exits), `api`,
`worker`, `web`. See [docker-compose.yml](../docker-compose.yml).

Override any variable in `.env` — at minimum, for anything beyond local
dev, change `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, point `STORAGE_*` at
real S3 (or keep MinIO if that's your object store of choice), and decide
whether to turn on real Stellar anchoring (`STELLAR_MODE=soroban`, see
[STELLAR.md](STELLAR.md)).

## Kubernetes (production)

Example manifests in [infra/k8s](../infra/k8s) — a starting point, not a
complete Helm chart:

- `api-deployment.yaml`, `worker-deployment.yaml`, `web-deployment.yaml` —
  each with resource requests/limits and a liveness/readiness probe
  (`/health/live`, `/health`) for the API.
- `hpa.yaml` — horizontal pod autoscaling for `api` and `worker` on CPU;
  the worker in particular is designed to scale horizontally — it holds no
  in-process state, so any number of replicas can pull from the same
  BullMQ queues safely.
- `secrets.example.yaml` — the shape of the Secret the deployments expect
  (`DATABASE_URL`, `REDIS_URL`, JWT secrets, storage credentials, Stellar
  operator secret); copy it, fill in real values, and apply it yourself
  rather than committing real secrets.
- `ingress.yaml` — routes `api.yourdomain.com` → `api` service and
  `app.yourdomain.com` → `web` service; swap in your own TLS/ingress
  controller annotations.

Postgres, Redis, and object storage are assumed to be managed services in
production (RDS/Cloud SQL, ElastiCache/Memorystore, S3/GCS) rather than
in-cluster — the manifests only deploy DocuLedger's own three
applications.

Apply in order:

```bash
kubectl create namespace doculedger
kubectl -n doculedger apply -f infra/k8s/secrets.yaml   # your filled-in copy of secrets.example.yaml
kubectl -n doculedger apply -f infra/k8s/
```

Run migrations as a one-off Job (or a Helm pre-upgrade hook) using the
`api` image with `command: ["pnpm", "--filter", "@doculedger/database", "exec", "prisma", "migrate", "deploy"]`
before rolling out a new `api`/`worker` version.

## Scaling notes

- **api**: stateless, scale on request volume/CPU. Put a Redis-backed
  throttler storage behind it once running more than one replica (the
  default `@nestjs/throttler` storage is in-memory per instance).
- **worker**: stateless, scale on queue depth (BullMQ exposes queue
  metrics; a KEDA `ScaledObject` on Redis list length is a natural fit) or
  CPU (OCR is CPU-bound). `WORKER_CONCURRENCY` controls in-process
  parallelism per replica; tune alongside CPU limits.
- **Database**: the schema is fully multi-tenant on a single Postgres
  instance with `organizationId` indexes on every hot table; vertical
  scaling / read replicas cover most growth before a tenant-sharding
  migration is needed.
- **Object storage**: S3 (or equivalent) scales independently by design —
  the API only ever issues presigned URLs and small `PutObject` calls.
  Encryption at rest is enforced by the **bucket's own default encryption
  setting**, not a per-request header (that header breaks against
  S3-compatible stores like MinIO unless they have their own KMS backend
  configured) — enable default encryption (SSE-S3 or SSE-KMS) on the
  bucket itself. `docker-compose.yml`'s `minio-init` does this locally via
  `mc encrypt set sse-s3`; on AWS, enable "Default encryption" in the S3
  bucket's properties (or set it via Terraform/CloudFormation).

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on every
push/PR: install, build, and test every package/app in the pnpm
workspace, plus `cargo test` for the Soroban contract. Extend it with a
docker build + push step and your deployment tool of choice (Argo CD,
Flux, a plain `kubectl apply` step, etc.) once you have a registry and
cluster to target.
