// scripts/01-discover-sgt-wallets.js
// ─────────────────────────────────────────────────────────────────────────────
// Discovers ALL Seeker Genesis Token holders by querying Token-2022 accounts
// with the known SGT mint authority. Uses Helius getTokenAccounts with pagination.
//
// Strategy:
//   Since each SGT has a UNIQUE mint address (one per device), we can't query
//   by a single mint. Instead, we use Helius DAS `searchAssets` with the SGT
//   group address to find all members of the token group, OR we query
//   getProgramAccounts on Token-2022 and filter by mint authority.
//
//   The most efficient approach is using searchAssets with grouping:
//   - Get all assets in the SGT group (GT22s89n...)
//   - Each result gives us the owner wallet + the SGT mint address
//
//   Alternative: Use getTokenAccounts with the Token-2022 program and filter
//   by mint authority after fetching. This is more RPC-intensive.
// ─────────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import {
  DB_PATH, SGT, HELIUS_RPC_URL, HELIUS_API_KEY,
  fetchWithRetry, dasCall, sleep, log, today,
} from "../config/index.js";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Record pipeline run
const runId = db.prepare(
  `INSERT INTO pipeline_runs (script, status) VALUES ('01-discover-sgt-wallets', 'running')`
).run().lastInsertRowid;

log("Starting SGT wallet discovery...", "start");

// ─── Method 1: searchAssets by group (preferred, most efficient) ─────────────

async function discoverViaSearchAssets() {
  const wallets = [];
  let page = 1;
  const limit = 1000;

  log("Using searchAssets to find all SGT group members...");

  while (true) {
    log(`  Fetching page ${page}...`);

    const result = await dasCall("searchAssets", {
      grouping: ["collection", SGT.GROUP_MINT_ADDRESS],
      page,
      limit,
    });

    if (!result?.items || result.items.length === 0) {
      log(`  No more results at page ${page}. Done.`);
      break;
    }

    for (const asset of result.items) {
      const owner = asset.ownership?.owner;
      const mint = asset.id;

      if (owner && mint) {
        wallets.push({ wallet: owner, sgtMint: mint });
      }
    }

    log(`  Page ${page}: found ${result.items.length} SGTs (total: ${wallets.length})`);

    if (result.items.length < limit) break;
    page++;

    // Respect rate limits
    await sleep(150);
  }

  return wallets;
}

// ─── Method 2: Fallback — getProgramAccounts on Token-2022 ──────────────────
// This is slower but doesn't depend on DAS indexing of the group.
// It fetches all Token-2022 accounts and filters by mint authority.

async function discoverViaProgramAccounts() {
  log("Fallback: Using getProgramAccounts to scan Token-2022 program...");
  log("⚠️  This method is slower and more RPC-intensive.");

  // We query all Token-2022 token accounts and then check each mint's authority.
  // For scale, this requires sampling or chunked processing.
  //
  // A production approach would use Helius webhooks or Geyser plugins to
  // stream new SGT mints in real-time rather than scanning.

  const wallets = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const params = {
      limit: 1000,
      displayOptions: {},
      programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    };
    if (cursor) params.cursor = cursor;

    log(`  Fetching token accounts page ${page}...`);

    const result = await dasCall("getTokenAccounts", params);

    if (!result?.token_accounts || result.token_accounts.length === 0) break;

    // We'd need to inspect each mint account to verify it's an SGT.
    // For now, log progress — in production, batch-fetch mint accounts
    // and check mintAuthority === SGT.MINT_AUTHORITY
    log(`  Page ${page}: ${result.token_accounts.length} Token-2022 accounts`);

    cursor = result.cursor;
    if (!cursor) break;
    await sleep(200);
  }

  return wallets;
}

// ─── Method 3: Helius getAssetsByGroup (another DAS approach) ────────────────

async function discoverViaGetAssetsByGroup() {
  const wallets = [];
  let page = 1;
  const limit = 1000;

  log("Using getAssetsByGroup to find all SGT holders...");

  while (true) {
    log(`  Fetching page ${page}...`);

    const result = await dasCall("getAssetsByGroup", {
      groupKey: "collection",
      groupValue: SGT.GROUP_MINT_ADDRESS,
      page,
      limit,
    });

    if (!result?.items || result.items.length === 0) {
      log(`  No more results. Done.`);
      break;
    }

    for (const asset of result.items) {
      const owner = asset.ownership?.owner;
      const mint = asset.id;
      if (owner && mint) {
        wallets.push({ wallet: owner, sgtMint: mint });
      }
    }

    log(`  Page ${page}: ${result.items.length} SGTs (cumulative: ${wallets.length})`);

    if (result.items.length < limit) break;
    page++;
    await sleep(150);
  }

  return wallets;
}

// ─── Main Execution ──────────────────────────────────────────────────────────

async function main() {
  let wallets = [];

  // Try searchAssets first, fall back to getAssetsByGroup
  try {
    wallets = await discoverViaSearchAssets();
  } catch (err) {
    log(`searchAssets failed: ${err.message}. Trying getAssetsByGroup...`, "warn");
    try {
      wallets = await discoverViaGetAssetsByGroup();
    } catch (err2) {
      log(`getAssetsByGroup also failed: ${err2.message}`, "error");
      throw err2;
    }
  }

  log(`Discovered ${wallets.length} SGT holders total.`);

  // ─── Upsert into database ───────────────────────────────────────────────

  const upsert = db.prepare(`
    INSERT INTO seeker_wallets (wallet_address, sgt_mint_address, first_seen)
    VALUES (?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      sgt_mint_address = excluded.sgt_mint_address
  `);

  const upsertMany = db.transaction((items) => {
    let inserted = 0;
    for (const { wallet, sgtMint } of items) {
      const result = upsert.run(wallet, sgtMint, today());
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  const count = upsertMany(wallets);
  log(`Upserted ${count} wallet records into seeker_wallets.`, "success");

  // Get total count
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM seeker_wallets").get();
  log(`Total SGT holders in database: ${totalRow.count}`);

  // Update pipeline run
  db.prepare(`
    UPDATE pipeline_runs SET finished_at = datetime('now'), status = 'success', records = ?
    WHERE id = ?
  `).run(wallets.length, runId);
}

main()
  .catch((err) => {
    log(`Fatal error: ${err.message}`, "error");
    db.prepare(`
      UPDATE pipeline_runs SET finished_at = datetime('now'), status = 'error', notes = ?
      WHERE id = ?
    `).run(err.message, runId);
    process.exit(1);
  })
  .finally(() => db.close());
