#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PolyPanel — update an existing install.
#
# Re-syncs the current checkout into /opt/polypanel, reinstalls deps, rebuilds
# (next build + worker), and restarts both services. Idempotent; run as root.
#
#   sudo deploy/update.sh
#
# Leaves alone: the system user, /var/lib/polypanel (your SQLite data), the env
# file (AUTH_PASSWORD), the nginx site, and any certbot-managed TLS.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="${APP_USER:-polypanel}"
APP_DIR="${APP_DIR:-/opt/polypanel}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"

log()  { printf '\033[1;36m[update]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[update] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[update] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must run as root (use sudo)."
id "$APP_USER" >/dev/null 2>&1 || die "user '$APP_USER' not found — run deploy/install.sh first."
[ -d "$APP_DIR" ] || die "$APP_DIR not found — run deploy/install.sh first."
[ -f "$REPO_DIR/package.json" ] || die "cannot find package.json at $REPO_DIR — run from the repo checkout."

export DEBIAN_FRONTEND=noninteractive

# ── Sync new code (same excludes as install: never touch deps/build/data/vcs) ─
if [ "$REPO_DIR" = "$APP_DIR" ]; then
  log "Repo checkout is already $APP_DIR — skipping sync (use 'git pull' here yourself)."
else
  log "Syncing $REPO_DIR -> $APP_DIR…"
  command -v rsync >/dev/null 2>&1 || die "rsync not installed — apt-get install rsync."
  rsync -a --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='.next/' \
    --exclude='dist/' \
    --exclude='data/' \
    --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
    "$REPO_DIR"/ "$APP_DIR"/
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

run_as() { runuser -u "$APP_USER" -- env -C "$APP_DIR" "$@"; }

# ── Deps + build ─────────────────────────────────────────────────────────────
# `npm ci` gives a clean, lockfile-exact tree (and recompiles better-sqlite3 if
# Node changed). Build needs devDeps, so do NOT omit them.
log "Running 'npm ci' as $APP_USER…"
run_as npm ci
# Wipe previous build output first. A changed Next.js build ID can otherwise
# leave orphaned chunks that the freshly-rendered HTML no longer references,
# producing browser "chunk 404" client-side exceptions that a cache-clear can't
# fix (the mismatch is server-side). A clean build dir guarantees consistency.
log "Cleaning previous build output (.next, dist)…"
rm -rf "$APP_DIR/.next" "$APP_DIR/dist"
log "Running 'npm run build' as $APP_USER…"
run_as npm run build
[ -f "$APP_DIR/dist/worker.js" ] || die "build did not produce dist/worker.js — not restarting services."

# ── Restart both services ────────────────────────────────────────────────────
log "Restarting polypanel-web and polypanel-poller…"
systemctl restart polypanel-web.service polypanel-poller.service

log "Update complete. Status:"
systemctl --no-pager --lines=0 status polypanel-web.service polypanel-poller.service 2>/dev/null || true
log "Tail logs with:  journalctl -u polypanel-poller -f"
