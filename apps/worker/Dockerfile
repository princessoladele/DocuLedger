# syntax=docker/dockerfile:1
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/stellar/package.json packages/stellar/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @doculedger/worker... 2>/dev/null || pnpm install --filter @doculedger/worker...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm --filter @doculedger/database... generate
RUN pnpm --filter @doculedger/shared... build
RUN pnpm --filter @doculedger/stellar... build
RUN pnpm --filter @doculedger/worker build

FROM base AS runtime
ENV NODE_ENV=production
# tesseract (OCR) and poppler-utils (PDF rasterization) are required at runtime, not just build time.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/worker ./apps/worker
WORKDIR /repo/apps/worker
USER node
CMD ["node", "dist/main.js"]
