#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PolyPanel — WAL-safe SQLite backup.
#
# Uses `sqlite3 .backup`, which takes a consistent online snapshot via the SQLite
# backup API — correct even while the poller is writing and the DB is in WAL mode
# (no need to stop services, no risk of copying a torn WAL). Writes a timestamped
# copy and prunes old ones.
#
#   sudo deploy/backup.sh
#   sudo BACKUP_DIR=/mnt/backups KEEP=30 deploy/backup.sh
#
# Override with env:
#   DATA_DIR    where polypanel.db lives        (default /var/lib/polypanel)
#   BACKUP_DIR  where snapshots are written      (default /var/backups/polypanel)
#   KEEP        how many recent backups to keep  (default 14; 0 = keep all)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DATA_DIR="${DATA_DIR:-/var/lib/polypanel}"
DB_FILE="${DB_FILE:-$DATA_DIR/polypanel.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/polypanel}"
KEEP="${KEEP:-14}"

log()  { printf '\033[1;36m[backup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[backup] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[backup] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 not installed — apt-get install sqlite3."
[ -f "$DB_FILE" ] || die "database not found at $DB_FILE (is the poller installed?)."

install -d -m 0750 "$BACKUP_DIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/polypanel-${TS}.db"
TMP="$OUT.partial"

log "Backing up $DB_FILE -> $OUT (online .backup, WAL-safe)…"
# Write to a .partial first so a crash mid-backup never leaves a truncated file
# that looks complete. busy_timeout lets .backup wait out the writer's checkpoint.
# Single-quote the path inside the SQL so spaces are safe.
if ! sqlite3 "$DB_FILE" \
      ".timeout 10000" \
      ".backup '$TMP'"; then
  rm -f "$TMP"
  die "sqlite3 .backup failed."
fi

# Verify the snapshot is a well-formed database before publishing it.
if ! sqlite3 "$TMP" "PRAGMA integrity_check;" | grep -qx 'ok'; then
  rm -f "$TMP"
  die "integrity_check failed on the snapshot — backup discarded."
fi

mv -f "$TMP" "$OUT"
chmod 0640 "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
log "Wrote $OUT ($SIZE)."

# Optionally compress to save space (keeps the .db too? no — replace it).
if command -v gzip >/dev/null 2>&1; then
  gzip -f "$OUT"
  OUT="$OUT.gz"
  log "Compressed -> $OUT ($(du -h "$OUT" | cut -f1))."
fi

# ── Retention: keep the newest $KEEP, delete older ones (0 = keep everything) ─
[[ "$KEEP" =~ ^[0-9]+$ ]] || die "KEEP must be a non-negative integer (got '$KEEP')."
if [ "$KEEP" -gt 0 ]; then
  mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/polypanel-*.db "$BACKUP_DIR"/polypanel-*.db.gz 2>/dev/null | tail -n +"$((KEEP + 1))")
  if [ "${#OLD[@]}" -gt 0 ]; then
    log "Pruning ${#OLD[@]} backup(s) beyond the most recent $KEEP…"
    rm -f -- "${OLD[@]}"
  fi
fi

log "Backup complete."
log "Restore with:  systemctl stop polypanel-web polypanel-poller && \\"
log "               gunzip -c '$OUT' > '$DB_FILE'   # (drop .gz if uncompressed) && \\"
log "               rm -f '$DB_FILE-wal' '$DB_FILE-shm' && \\"
log "               chown $(stat -c '%U:%G' "$DB_FILE" 2>/dev/null || echo polypanel:polypanel) '$DB_FILE' && \\"
log "               systemctl start polypanel-poller polypanel-web"
