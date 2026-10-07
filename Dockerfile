# Ein Container: Angular gebaut, vom Fastify-Server ausgeliefert.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/model/package.json     packages/model/
COPY packages/registry/package.json  packages/registry/
COPY apps/server/package.json        apps/server/
COPY apps/web/package.json           apps/web/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter @nw/model build \
 && pnpm --filter @nw/registry build \
 && pnpm --filter @nw/server build \
 && pnpm --filter web build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/model/package.json     packages/model/
COPY packages/registry/package.json  packages/registry/
COPY apps/server/package.json        apps/server/
RUN pnpm install --frozen-lockfile --prod --filter @nw/server...

COPY --from=build /app/packages/model/dist    ./packages/model/dist
COPY --from=build /app/packages/registry/dist ./packages/registry/dist
COPY --from=build /app/apps/server/dist       ./apps/server/dist
COPY --from=build /app/apps/server/migrations ./apps/server/migrations
COPY --from=build /app/apps/web/dist/web/browser ./apps/server/public

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "apps/server/dist/index.js"]
