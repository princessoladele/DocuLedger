# syntax=docker/dockerfile:1
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/stellar/package.json packages/stellar/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @doculedger/api... 2>/dev/null || pnpm install --filter @doculedger/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @doculedger/database... generate
RUN pnpm --filter @doculedger/shared... build
RUN pnpm --filter @doculedger/stellar... build
RUN pnpm --filter @doculedger/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
