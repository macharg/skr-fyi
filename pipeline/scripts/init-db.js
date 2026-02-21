// scripts/init-db.js — Initialize SQLite database with schema
import Database from "better-sqlite3";
import { DB_PATH, log } from "../config/index.js";
import { mkdirSync } from "fs";
import { dirname } from "path";

log("Initializing database...", "start");

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  -- Registry of all discovered Seeker Genesis Token holders
  CREATE TABLE IF NOT EXISTS seeker_wallets (
    wallet_address    TEXT PRIMARY KEY,
    sgt_mint_address  TEXT NOT NULL,          -- unique mint address of their SGT
    first_seen        TEXT NOT NULL DEFAULT (date('now')),
    last_active       TEXT,
    is_active         INTEGER DEFAULT 1       -- 0 if wallet appears abandoned
  );

  -- Daily aggregate snapshots (one row per day)
  CREATE TABLE IF NOT EXISTS daily_snapshots (
    date                TEXT PRIMARY KEY,       -- YYYY-MM-DD
    total_sgt_holders   INTEGER,
    active_wallets_24h  INTEGER,               -- wallets with ≥1 tx in 24h
    total_transactions  INTEGER,               -- tx count from seeker wallets
    swap_count          INTEGER,               -- number of swap transactions
    swap_volume_usd     REAL,                  -- estimated USD swap volume
    total_sol_held      REAL,                  -- aggregate SOL across all wallets
    total_value_usd     REAL,                  -- estimated total portfolio value
    skr_price           REAL,
    skr_market_cap      REAL,
    skr_staked_pct      REAL,
    sol_price           REAL,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  -- Per-wallet token holdings (refreshed daily, keeps latest only)
  CREATE TABLE IF NOT EXISTS wallet_holdings (
    wallet_address  TEXT NOT NULL,
    token_mint      TEXT NOT NULL,
    token_symbol    TEXT,
    amount          REAL,
    value_usd       REAL,
    updated_at      TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (wallet_address, token_mint)
  );

  -- dApp / protocol interaction counts
  CREATE TABLE IF NOT EXISTS dapp_interactions (
    date            TEXT NOT NULL,             -- YYYY-MM-DD
    program_id      TEXT NOT NULL,
    program_name    TEXT,
    category        TEXT,                      -- DEX, DeFi, NFT, Staking, etc.
    unique_wallets  INTEGER,                   -- unique seeker wallets interacting
    tx_count        INTEGER,                   -- total transactions
    volume_usd      REAL,
    PRIMARY KEY (date, program_id)
  );

  -- SKR-specific metrics over time
  CREATE TABLE IF NOT EXISTS skr_metrics (
    date              TEXT PRIMARY KEY,
    price             REAL,
    market_cap        REAL,
    volume_24h        REAL,
    circulating_supply REAL,
    total_staked      REAL,
    staked_pct        REAL,
    holders_count     INTEGER
  );

  -- Activity log for pipeline runs
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    script      TEXT NOT NULL,
    started_at  TEXT DEFAULT (datetime('now')),
    finished_at TEXT,
    status      TEXT,                          -- success, error
    records     INTEGER,
    notes       TEXT
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_wallets_last_active
    ON seeker_wallets(last_active);
  CREATE INDEX IF NOT EXISTS idx_holdings_wallet
    ON wallet_holdings(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_holdings_token
    ON wallet_holdings(token_mint);
  CREATE INDEX IF NOT EXISTS idx_dapp_date
    ON dapp_interactions(date);
  CREATE INDEX IF NOT EXISTS idx_snapshots_date
    ON daily_snapshots(date);
`);

log(`Database initialized at ${DB_PATH}`, "success");
log(`Tables: seeker_wallets, daily_snapshots, wallet_holdings, dapp_interactions, skr_metrics, pipeline_runs`, "info");

db.close();
