# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# PolyPanel — single image, two roles (web | worker).
#
# Multi-stage:
#   1) build   — full toolchain so `npm ci` can COMPILE better-sqlite3, then
#                `npm run build` produces BOTH .next/ and dist/worker.js. We
#                then prune dev deps in place, keeping the already-compiled
#                native module.
#   2) runtime — the SAME base (identical glibc/Node ABI, so the compiled
#                better-sqlite3 binary is valid), non-root, carrying only the
#                pruned node_modules + build artifacts.
#
# Strictly read-only app: no secrets are baked. Supply AUTH_PASSWORD (and any
# poller tuning) at runtime via env. SQLite lives under DATA_DIR (a volume).
# ─────────────────────────────────────────────────────────────────────────────

# ── 1) Build stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

# Toolchain required by node-gyp to compile better-sqlite3 from source.
# build-essential (gcc/g++/make) + python3. Cleaned up to keep the layer lean;
# this stage is discarded anyway, but a smaller layer caches/transfers faster.
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Install deps first for layer caching. We need devDependencies here (next,
# typescript, tailwind, tsx) to build, so DON'T pass --omit=dev yet. Native
# modules (better-sqlite3) are compiled during this step.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Build the app: `next build` → .next/ ; `tsc -p tsconfig.worker.json` → dist/.
COPY . .
RUN npm run build

# Ensure a public/ dir exists so the runtime COPY below always has a valid
# source (the repo may not ship one today; this keeps it forward-compatible).
RUN mkdir -p public

# Strip dev dependencies in place. The compiled better-sqlite3 binary stays
# (it's a prod dependency), so the pruned tree is runtime-ready and ABI-correct.
RUN npm prune --omit=dev


# ── 2) Runtime stage ─────────────────────────────────────────────────────────
# SAME base image as the build stage → identical Node/glibc ABI, so the
# better-sqlite3 .node binary compiled above runs without recompilation.
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Non-root runtime user. The node:* images already ship an unprivileged `node`
# user (uid/gid 1000); reuse it rather than inventing another.
# Create the SQLite data dir and hand it (plus the app dir) to that user.
RUN mkdir -p /data && chown -R node:node /data /app

# Carry ONLY what `next start` and the worker need:
#   - node_modules : pruned prod tree incl. the compiled better-sqlite3
#   - .next        : the built Next.js app
#   - dist         : the compiled poller (dist/worker.js)
#   - public       : static assets served by Next (if present)
#   - package.json : `npm run start` / `npm run worker` script definitions
#   - next.config.mjs : serverExternalPackages(better-sqlite3) etc.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.mjs ./next.config.mjs

# Entrypoint dispatches the role (web | worker). Default = web.
COPY --chown=node:node deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

# Persist the SQLite file/WAL across container restarts.
VOLUME ["/data"]

EXPOSE 3000

# NOTE: no image-level HEALTHCHECK on purpose. It would apply to BOTH roles —
# but the poller has no HTTP surface (always "unhealthy"), and /api/health
# returns 401 when AUTH_PASSWORD is set. Health is defined per-role in
# docker-compose.yml: the web service probes the auth-exempt /api/login, and
# the poller has no healthcheck. Add one in your orchestrator for the web role.

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["web"]
