#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PolyPanel — bare-metal Ubuntu VPS installer.
#
# Idempotent, run as root. Provisions a read-only Polymarket research panel as
# two systemd services (web + poller) sharing one SQLite file, fronted by nginx.
#
#   sudo deploy/install.sh                  # install / re-run (safe)
#   sudo DOMAIN=panel.example.com deploy/install.sh
#   sudo deploy/install.sh panel.example.com [you@example.com]
#
# What it does:
#   - ensures Node 20+ (installs NodeSource 22 if missing/too old)
#   - creates the `polypanel` system user
#   - creates /opt/polypanel (code) and /var/lib/polypanel (SQLite, owned by it)
#   - rsyncs the current checkout into /opt/polypanel (no node_modules/.next/...)
#   - runs `npm ci` + `npm run build` as polypanel
#   - writes /etc/polypanel/polypanel.env with a random AUTH_PASSWORD if absent
#   - installs + enables --now both systemd units
#   - installs the nginx site
#   - if DOMAIN is set: runs certbot --nginx non-interactively
#   - prints certbot + ufw next steps otherwise
#
# Strictly read-only app: no wallet, no keys, no trading. Boring & re-runnable.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Tunables (override via env) ──────────────────────────────────────────────
APP_USER="${APP_USER:-polypanel}"
APP_DIR="${APP_DIR:-/opt/polypanel}"
DATA_DIR="${DATA_DIR:-/var/lib/polypanel}"
ENV_DIR="${ENV_DIR:-/etc/polypanel}"
ENV_FILE="${ENV_FILE:-$ENV_DIR/polypanel.env}"
NODE_MAJOR="${NODE_MAJOR:-22}"          # NodeSource major to install if needed
NODE_MIN_MAJOR="${NODE_MIN_MAJOR:-20}"  # minimum acceptable major
SITE_NAME="${SITE_NAME:-polypanel}"
NGINX_AVAIL="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

# DOMAIN (and optional ACME_EMAIL) may come from env or positional args.
DOMAIN="${DOMAIN:-${1:-}}"
ACME_EMAIL="${ACME_EMAIL:-${2:-}}"

# Resolve the repo checkout = the parent dir of this script's directory.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"

log()  { printf '\033[1;36m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[install] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[install] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "must run as root (use sudo)."
command -v apt-get >/dev/null 2>&1 || die "this installer targets Ubuntu/Debian (apt-get not found)."
[ -f "$REPO_DIR/package.json" ] || die "cannot find package.json at $REPO_DIR — run from the repo checkout."

export DEBIAN_FRONTEND=noninteractive

# ── Base packages (idempotent: apt-get install is a no-op if present) ────────
log "Ensuring base packages (curl, ca-certificates, rsync, sqlite3, nginx, build tools)…"
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg rsync sqlite3 nginx \
  build-essential python3 \
  >/dev/null

# ── Node 20+ (install NodeSource $NODE_MAJOR if missing or too old) ──────────
node_major() {
  command -v node >/dev/null 2>&1 || return 1
  node -p 'process.versions.node.split(".")[0]' 2>/dev/null
}
need_node=1
cur="$(node_major || true)"
if [[ "$cur" =~ ^[0-9]+$ ]] && [ "$cur" -ge "$NODE_MIN_MAJOR" ]; then
  log "Node v$(node -v | sed 's/^v//') already satisfies >= ${NODE_MIN_MAJOR} — keeping it."
  need_node=0
elif [[ "$cur" =~ ^[0-9]+$ ]]; then
  warn "Node major $cur < ${NODE_MIN_MAJOR}; installing NodeSource ${NODE_MAJOR}."
else
  log "Node not found; installing NodeSource ${NODE_MAJOR}."
fi
if [ "$need_node" -eq 1 ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
  log "Installed Node $(node -v)."
fi
command -v npm >/dev/null 2>&1 || die "npm not available after Node install."

# ── System user ──────────────────────────────────────────────────────────────
if id "$APP_USER" >/dev/null 2>&1; then
  log "User '$APP_USER' already exists."
else
  log "Creating system user '$APP_USER' (home=$DATA_DIR, no login shell)."
  useradd --system --create-home --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

# ── Directories ──────────────────────────────────────────────────────────────
log "Ensuring $APP_DIR and $DATA_DIR (owned by $APP_USER)…"
install -d -m 0755 "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"
# DATA_DIR holds the SQLite file + WAL; only the app needs to read/write it.
install -d -m 0750 -o "$APP_USER" -g "$APP_USER" "$DATA_DIR"

# ── Sync the checkout into APP_DIR ───────────────────────────────────────────
# Exclude build artifacts, deps, vcs metadata, and any dev data so we deploy a
# clean tree and rebuild from source. Trailing slash on REPO_DIR copies contents.
if [ "$REPO_DIR" = "$APP_DIR" ]; then
  log "Repo checkout is already $APP_DIR — skipping sync."
else
  log "Syncing $REPO_DIR -> $APP_DIR (excluding node_modules/.next/dist/.git/data)…"
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

# ── Install deps + build (as the app user) ───────────────────────────────────
# `npm ci` needs devDependencies because `npm run build` runs tsc; do NOT omit
# dev deps. better-sqlite3 compiles its native addon here (build-essential).
log "Running 'npm ci' as $APP_USER (this compiles better-sqlite3)…"
run_as() { runuser -u "$APP_USER" -- env -C "$APP_DIR" "$@"; }
run_as npm ci
log "Running 'npm run build' as $APP_USER (next build + worker tsc)…"
run_as npm run build
[ -f "$APP_DIR/dist/worker.js" ] || die "build did not produce dist/worker.js — check build logs."

# ── Secrets / env file ───────────────────────────────────────────────────────
install -d -m 0750 "$ENV_DIR"
if [ -f "$ENV_FILE" ]; then
  log "Env file $ENV_FILE already exists — leaving it untouched."
else
  log "Creating $ENV_FILE with a random AUTH_PASSWORD (chmod 600)…"
  # 24 url-safe bytes ≈ 32 chars. openssl is in the base image via ca-certificates'
  # dependency chain, but fall back to /dev/urandom if absent.
  if command -v openssl >/dev/null 2>&1; then
    GEN_PW="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"
  else
    GEN_PW="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  umask 077
  cat > "$ENV_FILE" <<EOF
# PolyPanel runtime config (loaded by both systemd units). Not in git.
# Read-only app: AUTH_PASSWORD is the only secret. Edit + 'systemctl restart' to apply.
AUTH_PASSWORD=${GEN_PW}

# Poller tuning (optional — units set sane defaults; uncomment to override):
# POLL_INTERVAL=25
# MARKET_LIMIT=50
# DIVERGE_THRESHOLD=0.05
# ARB_FEE_BUFFER=0.01
# WIDE_SPREAD=0.05
# MAX_BACKOFF=300
# HISTORY_RETENTION_DAYS=14
EOF
  chmod 600 "$ENV_FILE"
  log "Generated AUTH_PASSWORD: ${GEN_PW}"
  warn "Save that password now — it is only printed here. Edit $ENV_FILE to change it."
fi
# The env file is read by systemd (root); polypanel never needs to read it, but
# keep it root-owned and locked down regardless.
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── systemd units ────────────────────────────────────────────────────────────
log "Installing systemd units…"
install -m 0644 "$APP_DIR/deploy/polypanel-web.service"    /etc/systemd/system/polypanel-web.service
install -m 0644 "$APP_DIR/deploy/polypanel-poller.service" /etc/systemd/system/polypanel-poller.service
systemctl daemon-reload
log "Enabling + starting polypanel-web and polypanel-poller…"
systemctl enable --now polypanel-web.service polypanel-poller.service
# Re-runs: enable --now does not restart an already-running unit, so pick up new
# code/config explicitly.
systemctl restart polypanel-web.service polypanel-poller.service

# ── nginx site ───────────────────────────────────────────────────────────────
log "Installing nginx site '$SITE_NAME'…"
# Don't clobber a certbot-modified vhost (it injects ssl_certificate lines). If
# the installed file already mentions a managed cert, leave it in place.
if [ -f "$NGINX_AVAIL" ] && grep -q "letsencrypt" "$NGINX_AVAIL" 2>/dev/null; then
  warn "$NGINX_AVAIL looks certbot-managed — not overwriting it."
else
  install -m 0644 "$APP_DIR/deploy/nginx-polypanel.conf" "$NGINX_AVAIL"
  # Substitute the server_name if a DOMAIN was provided so the vhost matches.
  if [ -n "$DOMAIN" ]; then
    sed -i "s/panel\.example\.com/${DOMAIN}/g" "$NGINX_AVAIL"
  fi
fi
ln -sfn "$NGINX_AVAIL" "$NGINX_ENABLED"
# Disable the stock default site if present so it doesn't shadow ours on :80.
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default || true
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  log "nginx config OK, reloaded."
else
  warn "nginx -t failed — fix $NGINX_AVAIL then 'systemctl reload nginx'. Continuing."
fi

# ── TLS (optional, non-interactive) ──────────────────────────────────────────
if [ -n "$DOMAIN" ]; then
  log "DOMAIN set ($DOMAIN) — provisioning Let's Encrypt cert via certbot…"
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  fi
  EMAIL_ARGS=(--register-unsafely-without-email)
  if [ -n "$ACME_EMAIL" ]; then
    EMAIL_ARGS=(--email "$ACME_EMAIL")
  fi
  # --nginx edits the vhost in place (adds 443 + http->https redirect).
  # Idempotent: certbot reuses an existing valid cert (--keep-until-expiring).
  if certbot --nginx -n --agree-tos --redirect --keep-until-expiring \
       "${EMAIL_ARGS[@]}" -d "$DOMAIN"; then
    log "certbot succeeded — TLS active for https://$DOMAIN"
  else
    warn "certbot failed (DNS not pointed yet? port 80 blocked?). Re-run later:"
    warn "  certbot --nginx -d $DOMAIN"
  fi
fi

# ── Summary + next steps ─────────────────────────────────────────────────────
echo
log "Install complete. Service status:"
systemctl --no-pager --lines=0 status polypanel-web.service polypanel-poller.service 2>/dev/null || true
echo
log "Next steps:"
if [ -z "$DOMAIN" ]; then
  cat <<EOF
  1) Point your domain's A record at this VPS, then provision TLS:
       sudo certbot --nginx -d panel.example.com
     (or re-run this script with DOMAIN set:
        sudo DOMAIN=panel.example.com deploy/install.sh )
EOF
fi
cat <<EOF
  2) Firewall — allow SSH + HTTP + HTTPS only, then enable UFW:
       sudo ufw allow OpenSSH
       sudo ufw allow 'Nginx Full'      # opens 80 + 443
       sudo ufw --force enable
  3) Logs:
       journalctl -u polypanel-poller -f
       journalctl -u polypanel-web -f
  4) Auth password lives in:  $ENV_FILE  (AUTH_PASSWORD)
     Edit it, then:  sudo systemctl restart polypanel-web
  5) Backups:  sudo deploy/backup.sh        (WAL-safe SQLite snapshot)
  6) Updates:  sudo deploy/update.sh        (re-sync + rebuild + restart)
EOF
log "Done."
