#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# PolyPanel container entrypoint — one image, two roles.
#
#   web    → `npm run start`        (Next.js: UI + API route handlers, reads DB)
#   worker → `node dist/worker.js`  (the sole poller that talks to Polymarket)
#
# Usage (role is the first arg; defaults to "web"):
#   docker run ... <image>            # web
#   docker run ... <image> web        # web
#   docker run ... <image> worker     # poller
#
# Boring & debuggable: exec so the chosen process is PID 1 and receives signals
# (clean SIGTERM shutdown). No secrets handled here; config comes from env.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

# Default role is "web". If the first arg looks like a flag (starts with "-"),
# treat the whole invocation as a web override and pass it through to next.
role="${1:-web}"
case "$role" in
  -*) role="web" ;;
  *) [ "$#" -gt 0 ] && shift || true ;;
esac

case "$role" in
  web)
    echo "[entrypoint] starting role=web on 0.0.0.0:${PORT:-3000} (DATA_DIR=${DATA_DIR:-/data})"
    # `next start` honors PORT and HOSTNAME from the env (set in the image).
    # Any extra args ("$@") are forwarded to `next start`.
    exec npm run start -- "$@"
    ;;
  worker)
    echo "[entrypoint] starting role=worker (DATA_DIR=${DATA_DIR:-/data}, POLL_INTERVAL=${POLL_INTERVAL:-25}s)"
    exec node dist/worker.js "$@"
    ;;
  *)
    echo "[entrypoint] unknown role '$role' — expected 'web' or 'worker'" >&2
    echo "[entrypoint] usage: docker run <image> [web|worker]" >&2
    exit 64
    ;;
esac
