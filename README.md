# ReFx PolyPanel

A single-user, **read-only** web panel for Polymarket research. It continuously
reads public market data, runs implied-probability / spread / binary-arbitrage /
divergence analysis, and presents it as a live, sortable dashboard with a market
detail view, a probability-over-time history, your own probability calls, and a
calibration backtest.

> **Strictly read-only.** No wallet, no keys, no order placement, no trading
> endpoints — by design and by contract. This is a glance-first research
> dashboard, not a trading client. Adding trading is explicitly out of scope.

---

## What it does

- **Discovers** the top active markets by 24h volume (Gamma API).
- **Batch-fetches** their order books (CLOB `/books`) from a single poller.
- **Analyzes** each market with pure functions ported from the reference
  `polymarket_scanner.py`:
  - `summarizeBook` — best bid/ask, mid (= implied probability), spread, depth.
  - `checkBinaryArbitrage` — Yes+No < $1 (buy) or > $1 (sell), capped by resting
    depth, with a fee buffer. Reported **gross**.
  - `fairValueDivergence` — market mid vs *your* estimate.
- **Stores** snapshots, an append-only probability history, your estimates, and a
  signals log in SQLite (WAL).
- **Serves** a dark, information-dense dashboard that auto-refreshes from the
  local cache. The browser never talks to Polymarket directly.

### Honesty guardrails (the point of the tool)

- A high implied probability is the market's **consensus, not edge** — markets are
  never ranked or badged by "most likely to win."
- The only edge signal is **DIVERGE** (your estimate vs the market).
- **ARB** is always shown *gross*, with the depth cap and a fee caveat inline.

---

## Architecture

```
Polymarket Gamma + CLOB (public, no auth)
            │  (only the poller talks to Polymarket)
            ▼
   Poller (systemd)  ──writes──▶  SQLite (WAL)  ◀──reads──  Web (Next.js, systemd)
   every ~25s                     snapshots +                 API routes + UI
   batch /books                   prob history +                     │
   backoff on 429                 estimates + signals          nginx :443 → :3000
```

Two long-running processes, one SQLite file, fronted by nginx + TLS. Page loads
are instant (they read the cache) and the API is hit at a controlled rate by
exactly one poller.

### Project layout

```
src/lib/engine.ts       Pure analysis functions (Phase 0) — covered by tests
src/lib/polymarket.ts   The ONLY module that fetches from Polymarket (read-only)
src/lib/db.ts           SQLite connection + schema (WAL)
src/lib/store.ts        Typed query helpers (writes from poller, reads from API)
src/lib/flags.ts        Display-flag computation, shared by poller + API
src/lib/views.ts        Server-side market view aggregation
src/lib/auth.ts         Single-user session token helpers
src/worker.ts           The poller process → compiled to dist/worker.js
src/app/api/*           Route handlers (markets, health, signals, estimates, backtest, login)
src/app/*               Dashboard, market detail, My Calls, login pages
src/components/*         React UI components
test/engine.test.ts     Offline self-test (synthetic books)
deploy/*                systemd units + nginx config
```

---

## Quickstart (development)

```bash
npm install
npm test                 # engine self-test (no network)

# Terminal 1 — poller (populates ./data/polypanel.db)
npm run worker:dev

# Terminal 2 — web app
npm run dev              # http://localhost:3000
```

In dev, `DATA_DIR` defaults to `./data` and auth is disabled unless you set
`AUTH_PASSWORD`.

### Configuration

Copy `.env.example` → `.env` (never commit `.env`). Everything has a safe
default:

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Web server port (nginx proxies to it). |
| `DATA_DIR` | `./data` | Where `polypanel.db` lives. Service user must own it. |
| `POLL_INTERVAL` | `25` | Seconds between poll cycles. |
| `MARKET_LIMIT` | `50` | Top markets by 24h volume to track. |
| `DIVERGE_THRESHOLD` | `0.05` | Abs prob diff that raises a DIVERGE flag. |
| `ARB_FEE_BUFFER` | `0.01` | Fee/slippage buffer for arb detection ($/share). |
| `WIDE_SPREAD` | `0.05` | Spread (in $) that raises a WIDE flag. |
| `MARKET_CATEGORIES` | _(empty)_ | Comma-separated category slugs (e.g. `politics,sports,business`). Empty = all markets. **Approximate** "Polymarket US" view — filters by market *type*, **not** verified NY tradeability. |
| `AUTH_PASSWORD` | _(unset)_ | Single-user login password. Unset = open (dev only). |

---

## API contract

| Route | Method | Purpose |
|---|---|---|
| `/api/markets?flag=&min_volume=&sort=` | GET | Latest snapshots + computed flags. |
| `/api/markets/:slug` | GET | Current books + `prob_history` series + flags. |
| `/api/signals?since=` | GET | Recent flagged signals. |
| `/api/estimates` | GET / POST | List / create probability calls. |
| `/api/estimates/:id` | DELETE / PATCH | Remove / resolve (`{outcome:1|0}`). |
| `/api/health` | GET | Poller status (`ok`/`stale`/`down`) for the status bar. |
| `/api/backtest` | GET | Calibration (hit rate + Brier vs market) over resolved calls. |

---

## Deployment

Two supported paths — full runbook in [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

**Docker / Compose (portable, any host):**

```bash
cp .env.docker.example .env     # set a strong AUTH_PASSWORD
docker compose build && docker compose up -d           # web (127.0.0.1:3000) + poller
docker compose --profile tls up -d                     # optional: + Caddy auto-TLS
```

**Bare-metal Ubuntu VPS (one command, idempotent):**

```bash
sudo ./deploy/install.sh                                       # HTTP only
sudo DOMAIN=panel.example.com ACME_EMAIL=you@example.com ./deploy/install.sh  # + TLS
```

The installer creates the `polypanel` user, builds the app, writes a random
`AUTH_PASSWORD`, installs both systemd units, and wires up nginx + certbot.
`deploy/update.sh` and `deploy/backup.sh` handle updates and WAL-safe backups.

### Manual VPS setup (what the installer automates)

Prereqs: Ubuntu 22.04/24.04, a domain pointed at the VPS, Node 20+ LTS, nginx,
certbot.

```bash
# 1. App
sudo useradd --system --create-home --home-dir /var/lib/polypanel polypanel
sudo mkdir -p /opt/polypanel && sudo chown polypanel: /opt/polypanel
sudo -u polypanel git clone <repo> /opt/polypanel && cd /opt/polypanel
sudo -u polypanel npm ci
sudo -u polypanel npm run build          # next build + dist/worker.js
sudo install -d -o polypanel -g polypanel /var/lib/polypanel

# 2. Secrets (not in git)
sudo install -d /etc/polypanel
echo 'AUTH_PASSWORD=change-me-to-something-strong' | sudo tee /etc/polypanel/polypanel.env

# 3. Services
sudo cp deploy/polypanel-web.service deploy/polypanel-poller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now polypanel-web polypanel-poller

# 4. Reverse proxy + TLS
sudo cp deploy/nginx-polypanel.conf /etc/nginx/sites-available/polypanel
sudo ln -s /etc/nginx/sites-available/polypanel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d panel.example.com   # provisions TLS + 80->443 redirect

# 5. Firewall
sudo ufw allow 22,80,443/tcp && sudo ufw enable
```

**Operate**

```bash
journalctl -u polypanel-poller -f          # poller logs
journalctl -u polypanel-web -f             # web logs
```

**Update**

```bash
cd /opt/polypanel && sudo -u polypanel git pull \
  && sudo -u polypanel npm ci \
  && sudo -u polypanel npm run build \
  && sudo systemctl restart polypanel-web polypanel-poller
```

**Back up** — copy the SQLite file (WAL-safe):

```bash
sqlite3 /var/lib/polypanel/polypanel.db ".backup '/var/backups/polypanel-$(date +%F).db'"
```

---

## Security

Read-only means **there are no money-moving secrets** — the only goal is "don't
let randoms read your panel."

- **Auth:** single-user app-level session (`AUTH_PASSWORD`); the middleware gates
  every route. Optionally add nginx basic auth too (see the nginx config).
- **TLS:** Let's Encrypt via certbot; HSTS on the 443 block.
- **Secrets:** `AUTH_PASSWORD` lives in `/etc/polypanel/polypanel.env`, never in
  git. Nothing else is sensitive.
- **Network:** UFW allows 22/80/443 only; bind the app to `127.0.0.1:3000` so
  only nginx can reach it.

---

## Testing

```bash
npm test          # engine self-test: best-price selection regardless of input
                  # order, buy/sell arb math, divergence threshold, JSON parsing
npm run typecheck # full TS typecheck
npm run build     # production build (web + worker)
```
