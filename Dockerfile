# Self-hosted single-container image for Khameleon's default (single-tenant
# per install) deployment mode - see SELF_HOSTING.md and the 2026-09-08/09
# deployment-model decisions in khameleon-decisions-log.md.
#
# One container serves both the API and the built frontend (api-server's
# app.ts optionally serves static files when WEB_DIST_PATH is set - see
# there for why this was simpler than adding nginx as a third moving part).

FROM node:24-slim AS builder

RUN corepack enable

WORKDIR /app

# Install the whole workspace once, at the root, so pnpm's workspace linking
# resolves correctly - api-server/khameleon-command aren't independently
# installable outside the monorepo.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY apps ./apps
COPY khameleon-file-agent ./khameleon-file-agent
COPY khameleon-memory ./khameleon-memory
COPY khameleon-window-agent ./khameleon-window-agent
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# lib/db is a composite TS project emitting declaration-only output that
# api-server imports from - must be built before api-server's own build,
# same order this session's own local dev always followed.
RUN pnpm run typecheck:libs

RUN pnpm --filter @workspace/api-server run build

# BASE_PATH=/ matches every local run this session used. VITE_API_URL is
# deliberately left unset - the built frontend then calls a same-origin
# relative /api path, which app.ts (this same container) serves directly.
# PORT is only meaningful to Vite's dev server, but vite.config.ts requires
# it to be set even for a production build.
RUN PORT=4001 BASE_PATH=/ pnpm --filter @workspace/khameleon-command run build


FROM node:24-slim AS runtime

WORKDIR /app

# api-server's build.mjs bundles nearly everything (express, drizzle-orm,
# the Anthropic/OpenAI SDKs, pg) into dist/index.mjs - only pino's transport
# worker files are emitted alongside it. No node_modules needed for this part.
COPY --from=builder /app/artifacts/api-server/dist ./dist

# The built static frontend.
COPY --from=builder /app/artifacts/khameleon-command/dist/public ./web

# drizzle-kit push runs against the real Postgres connection at container
# *start* time (not build time, since no database exists yet during image
# build) - needs lib/db's schema source plus drizzle-kit itself, unlike
# api-server's own runtime dependencies above (all bundled into dist/).
# pnpm's node_modules is a symlink tree back to the root .pnpm content-
# addressable store - copying lib/db/node_modules alone leaves dangling
# symlinks (confirmed by a real run: "Cannot find module .../drizzle-kit/
# bin.cjs"), so the root store has to come along too.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib/db/node_modules ./lib/db/node_modules
COPY --from=builder /app/lib/db/src ./lib/db/src
COPY --from=builder /app/lib/db/package.json /app/lib/db/drizzle.config.ts ./lib/db/

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV WEB_DIST_PATH=/app/web
ENV PORT=4001
EXPOSE 4001

ENTRYPOINT ["./entrypoint.sh"]
