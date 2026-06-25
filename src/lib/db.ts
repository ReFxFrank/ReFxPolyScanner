// ── SQLite store ──────────────────────────────────────────────────────────
// Single file, WAL mode: zero-config, file-backed, trivially backed up — the
// right store for a single-node personal panel. The poller writes; API routes
// read. WAL allows the reader and the single writer to coexist.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : path.join(process.cwd(), "data");

let _db: Database.Database | null = null;

/** Lazily open (and migrate) the shared database. */
export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "polypanel.db");
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("synchronous = NORMAL");
  conn.pragma("busy_timeout = 5000");
  migrate(conn);
  _db = conn;
  return conn;
}

function migrate(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS markets (
      slug TEXT PRIMARY KEY, question TEXT NOT NULL, condition_id TEXT,
      yes_token_id TEXT, no_token_id TEXT, outcomes TEXT, is_binary INTEGER,
      neg_risk INTEGER, volume REAL, volume_24h REAL, updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS books (
      token_id TEXT PRIMARY KEY, slug TEXT, outcome TEXT,
      best_bid REAL, best_ask REAL, bid_depth REAL, ask_depth REAL,
      mid REAL, spread REAL, updated_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);

    CREATE TABLE IF NOT EXISTS prob_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, token_id TEXT,
      mid REAL, ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_prob_history_slug_ts ON prob_history(slug, ts);

    CREATE TABLE IF NOT EXISTS estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, your_prob REAL,
      market_at_log REAL, note TEXT, created_at INTEGER,
      resolved INTEGER DEFAULT 0, outcome INTEGER
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT,
      kind TEXT, detail TEXT, ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);

    -- Single-row poller health record (id = 1).
    CREATE TABLE IF NOT EXISTS poller_health (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_success INTEGER, last_run INTEGER, last_duration_ms INTEGER,
      consecutive_errors INTEGER DEFAULT 0, last_error TEXT, market_count INTEGER
    );
  `);
}

export { DATA_DIR };
