# PolyPanel — Deployment Runbook

Two supported paths. Both run the **same two processes** (web + poller) sharing
**one SQLite file**, and both keep the app strictly read-only.

- **A. Docker / Compose** — portable; runs on any Docker host. Easiest.
- **B. Bare-metal Ubuntu VPS** — systemd + nginx + Let's Encrypt. Matches the
  ReFx VPS conventions.

> The panel is single-user. Set a strong `AUTH_PASSWORD` before exposing it to
> the internet. With it unset the panel is **open** (fine only for localhost/dev).

---

## A. Docker / Compose

Prereq: Docker Engine + Compose v2/v5 on the host.

```bash
cp .env.docker.example .env
# edit .env: set a strong AUTH_PASSWORD (and DOMAIN/ACME_EMAIL if using TLS)

docker compose build
docker compose up -d            # starts web (127.0.0.1:3000) + poller
docker compose logs -f poller   # watch the poller
```

- `web` binds to **127.0.0.1:3000** only — front it with a reverse proxy for the
  internet (next section), or change the published port in `docker-compose.yml`.
- `poller` is the sole writer; `web` only reads. They share the `data` named
  volume at `/data`. **Keep that volume on local disk** — SQLite WAL locking is
  unsafe on NFS/CIFS.

### TLS with the built-in Caddy profile

Point your domain's DNS at the host, set `DOMAIN` and `ACME_EMAIL` in `.env`, then:

```bash
docker compose --profile tls up -d   # adds Caddy: :80/:443 → web:3000, auto-cert
```

Caddy auto-provisions and renews a Let's Encrypt certificate and redirects
HTTP→HTTPS. (Don't also publish `web`'s port publicly — keep it on loopback.)

### Update / backup (Docker)

```bash
git pull && docker compose build && docker compose up -d        # update
docker compose exec poller sqlite3 /data/polypanel.db \
  ".backup '/data/backup-$(date -u +%Y%m%dT%H%M%SZ).db'"        # WAL-safe backup
```

---

## B. Bare-metal Ubuntu VPS (systemd + nginx + TLS)

Prereq: Ubuntu 22.04/24.04, root/sudo, a domain's A record pointed at the VPS.
Run the installer **from a checkout of this repo**:

```bash
sudo ./deploy/install.sh                                   # install (HTTP only)
# …or provision TLS in one shot:
sudo DOMAIN=panel.example.com ACME_EMAIL=you@example.com ./deploy/install.sh
```

The installer is idempotent. It installs Node 22 (if missing), creates the
`polypanel` system user, syncs the app to `/opt/polypanel`, builds it, writes
`/etc/polypanel/polypanel.env` with a **random `AUTH_PASSWORD`** (printed once —
save it), installs + enables both systemd units, wires up the nginx site, and
runs certbot when `DOMAIN` is set.

Then lock down the firewall:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```

### Operate

```bash
systemctl status polypanel-web polypanel-poller
journalctl -u polypanel-poller -f
# change the password:
sudoedit /etc/polypanel/polypanel.env  &&  sudo systemctl restart polypanel-web
```

### Update / backup (VPS)

```bash
sudo ./deploy/update.sh     # re-sync + npm ci + build + restart (data untouched)
sudo ./deploy/backup.sh     # WAL-safe snapshot to /var/backups/polypanel (gzip, retained)
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Status bar shows **stale/down** | `journalctl -u polypanel-poller -f` (Docker: `docker compose logs poller`) — look for repeated 429/backoff or a crash. |
| Web returns **401** to everything | `AUTH_PASSWORD` is set — log in at `/login`. Health probes use the auth-exempt `/api/login`. |
| Empty dashboard | The poller hasn't completed a cycle yet, or it can't reach Polymarket. Confirm outbound HTTPS to `gamma-api.polymarket.com` / `clob.polymarket.com`. |
| `better-sqlite3` build error | Build host needs `build-essential` + `python3` (the installer and the Docker build stage add these). |
| DB looks corrupt after a restore | Restore must also delete the stale `-wal`/`-shm` sidecars; see `backup.sh`'s printed restore steps. |
| certbot failed | DNS must resolve to this host and port 80 must be reachable before requesting a cert. Re-run `certbot --nginx -d <domain>`. |

## What this never does

No wallet, no private keys, no order placement, no trading endpoints. The only
process that talks to Polymarket is the poller, and it only **reads** public
data. The only secret in the whole system is `AUTH_PASSWORD`.
