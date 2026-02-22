// scripts/01-discover-sgt-wallets.js
// ─────────────────────────────────────────────────────────────────────────────
// Discovers Seeker Genesis Token holders by scanning the mint authority's
// transaction history. Each SGT mint shows up as a TRANSFER event from the
// mint authority. We extract the mint addresses and resolve owners via getAsset.
//
// Strategy (proven in diagnostic testing):
//   1. getSignaturesForAddress on the mint authority → get all mint txs
//   2. Helius Enhanced Transaction API → extract SGT mint addresses from transfers
//   3. getAsset on each mint → resolve current owner
//   4. Upsert into seeker_wallets table
//
// On first run: scans full history (may take a while for 200K+ devices)
// On subsequent runs: scans only new transactions since last run
// ─────────────────────────────────────────────────────────────────────────────

console.log("=== DISCOVERY SCRIPT v2 STARTING ===");

import Database from "better-sqlite3";
import {
  DB_PATH, SGT, HELIUS_RPC_URL, HELIUS_API_KEY, HELIUS_API_URL,
  fetchWithRetry, rpcCall, dasCall, sleep, log, today,
} from "../config/index.js";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Record pipeline run
const runId = db.prepare(
  `INSERT INTO pipeline_runs (script, status) VALUES ('01-discover-sgt-wallets', 'running')`
).run().lastInsertRowid;

log("Starting SGT wallet discovery...", "start");

// ─── Config ──────────────────────────────────────────────────────────────────

const MINT_AUTHORITY = SGT.MINT_AUTHORITY;
const TX_BATCH_SIZE = 50;       // transactions per enhanced API call
const ASSET_BATCH_SIZE = 100;   // getAsset calls per batch
const MAX_PAGES = 500;          // safety limit: 500 pages × 50 txs = 25K txs per run
const DELAY_BETWEEN_PAGES = 300; // ms between API pages

// ─── Step 1: Get transaction signatures ──────────────────────────────────────

async function getAllMintSignatures() {
  log("Step 1: Fetching mint authority transaction signatures...");

  // Check if we have a cursor from a previous run
  const lastSig = db.prepare(
    `SELECT value FROM pipeline_state WHERE key = 'last_mint_sig'`
  ).get();

  // Create state table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const existingLastSig = db.prepare(
    `SELECT value FROM pipeline_state WHERE key = 'last_mint_sig'`
  ).get();

  const signatures = [];
  let before = undefined;
  let page = 0;
  let reachedKnown = false;

  while (page < MAX_PAGES) {
    page++;
    const params = [MINT_AUTHORITY, { limit: 1000 }];
    if (before) params[1].before = before;

    try {
      const sigs = await rpcCall("getSignaturesForAddress", params);

      if (!sigs || sigs.length === 0) {
        log(`  Page ${page}: No more signatures. Done.`);
        break;
      }

      // Check if we've reached a previously seen signature
      if (existingLastSig) {
        const knownIdx = sigs.findIndex(s => s.signature === existingLastSig.value);
        if (knownIdx >= 0) {
          // Only include signatures before the known one
          signatures.push(...sigs.slice(0, knownIdx));
          log(`  Page ${page}: Reached known signature. Added ${knownIdx} new sigs.`);
          reachedKnown = true;
          break;
        }
      }

      signatures.push(...sigs);
      before = sigs[sigs.length - 1].signature;

      log(`  Page ${page}: Got ${sigs.length} sigs (total: ${signatures.length})`);

      if (sigs.length < 1000) {
        log(`  End of history reached.`);
        break;
      }

      await sleep(DELAY_BETWEEN_PAGES);
    } catch (e) {
      log(`  Error on page ${page}: ${e.message}`, "error");
      break;
    }
  }

  // Save the newest signature for next run
  if (signatures.length > 0) {
    db.prepare(`
      INSERT OR REPLACE INTO pipeline_state (key, value, updated_at)
      VALUES ('last_mint_sig', ?, datetime('now'))
    `).run(signatures[0].signature);
  }

  log(`  Total signatures to process: ${signatures.length}`, "success");
  return signatures;
}

// ─── Step 2: Extract SGT mints from transactions ─────────────────────────────

async function extractSGTMints(signatures) {
  log("Step 2: Parsing transactions for SGT mints...");

  const sgtMints = new Map(); // mint → { owner, timestamp }

  // Process in batches using Enhanced Transaction API
  for (let i = 0; i < signatures.length; i += TX_BATCH_SIZE) {
    const batch = signatures.slice(i, i + TX_BATCH_SIZE);
    const batchSigs = batch.map(s => s.signature);

    try {
      const url = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;
      const data = await fetchWithRetry(url, {
        method: "POST",
        body: JSON.stringify({ transactions: batchSigs }),
      });

      if (data && Array.isArray(data)) {
        for (const tx of data) {
          // Look for token transfers — these are SGT mints/transfers
          if (tx.tokenTransfers) {
            for (const tt of tx.tokenTransfers) {
              if (tt.mint &&
                  tt.tokenAmount === 1 &&
                  tt.mint !== "So11111111111111111111111111111111111111112") {
                sgtMints.set(tt.mint, {
                  toWallet: tt.toUserAccount,
                  timestamp: tx.timestamp,
                });
              }
            }
          }
        }
      }

      const progress = Math.min(i + TX_BATCH_SIZE, signatures.length);
      if (progress % (TX_BATCH_SIZE * 5) === 0 || progress === signatures.length) {
        log(`  Progress: ${progress}/${signatures.length} txs → ${sgtMints.size} SGT mints found`);
      }

      await sleep(DELAY_BETWEEN_PAGES);
    } catch (e) {
      log(`  Error parsing batch at offset ${i}: ${e.message}`, "warn");
      await sleep(1000);
    }
  }

  log(`  Discovered ${sgtMints.size} unique SGT mint addresses`, "success");
  return sgtMints;
}

// ─── Step 3: Resolve current owners via getAsset ─────────────────────────────

async function resolveOwners(sgtMints) {
  log("Step 3: Resolving current wallet owners...");

  const mintEntries = Array.from(sgtMints.entries());
  const wallets = [];

  for (let i = 0; i < mintEntries.length; i += ASSET_BATCH_SIZE) {
    const batch = mintEntries.slice(i, i + ASSET_BATCH_SIZE);

    // Use getAssetBatch for efficiency (up to 1000 at a time)
    const ids = batch.map(([mint]) => mint);

    try {
      const res = await fetchWithRetry(HELIUS_RPC_URL, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAssetBatch",
          params: { ids },
        }),
      });

      if (res.result && Array.isArray(res.result)) {
        for (const asset of res.result) {
          if (asset && asset.ownership?.owner) {
            wallets.push({
              wallet: asset.ownership.owner,
              sgtMint: asset.id,
              frozen: asset.ownership.frozen,
            });
          }
        }
      }
    } catch (e) {
      // Fallback: individual getAsset calls
      log(`  Batch failed, falling back to individual calls: ${e.message}`, "warn");
      for (const [mint, info] of batch) {
        try {
          const res = await fetchWithRetry(HELIUS_RPC_URL, {
            method: "POST",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getAsset",
              params: { id: mint },
            }),
          });
          if (res.result?.ownership?.owner) {
            wallets.push({
              wallet: res.result.ownership.owner,
              sgtMint: mint,
            });
          }
        } catch (e2) {
          // Skip failed individual lookups
        }
        await sleep(50);
      }
    }

    const progress = Math.min(i + ASSET_BATCH_SIZE, mintEntries.length);
    if (progress % (ASSET_BATCH_SIZE * 5) === 0 || progress === mintEntries.length) {
      log(`  Progress: ${progress}/${mintEntries.length} → ${wallets.length} wallets resolved`);
    }

    await sleep(DELAY_BETWEEN_PAGES);
  }

  log(`  Resolved ${wallets.length} wallet owners`, "success");
  return wallets;
}

// ─── Step 4: Upsert into database ───────────────────────────────────────────

function saveWallets(wallets) {
  log("Step 4: Saving to database...");

  const upsert = db.prepare(`
    INSERT INTO seeker_wallets (wallet_address, sgt_mint_address, first_seen, is_active)
    VALUES (?, ?, date('now'), 1)
    ON CONFLICT(wallet_address) DO UPDATE SET
      sgt_mint_address = excluded.sgt_mint_address,
      is_active = 1
  `);

  const insertMany = db.transaction((list) => {
    let inserted = 0;
    let updated = 0;
    for (const w of list) {
      const result = upsert.run(w.wallet, w.sgtMint);
      if (result.changes > 0) {
        if (result.changes === 1) inserted++;
        else updated++;
      }
    }
    return { inserted, updated };
  });

  const { inserted, updated } = insertMany(wallets);

  const total = db.prepare(`SELECT COUNT(*) as count FROM seeker_wallets`).get();

  log(`  New: ${inserted}, Updated: ${updated}, Total in DB: ${total.count}`, "success");
  return total.count;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    // Verify connectivity
    const slot = await rpcCall("getSlot", []);
    log(`Connected to Solana (slot: ${slot})`);

    // Step 1: Get signatures
    const signatures = await getAllMintSignatures();

    if (signatures.length === 0) {
      log("No new transactions found. Database is up to date.", "success");
      db.prepare(`UPDATE pipeline_runs SET status = 'success', ended_at = datetime('now') WHERE id = ?`).run(runId);
      db.close();
      return;
    }

    // Step 2: Extract SGT mints
    const sgtMints = await extractSGTMints(signatures);

    if (sgtMints.size === 0) {
      log("No SGT mints found in transactions.", "warn");
      db.prepare(`UPDATE pipeline_runs SET status = 'success', ended_at = datetime('now') WHERE id = ?`).run(runId);
      db.close();
      return;
    }

    // Step 3: Resolve owners
    const wallets = await resolveOwners(sgtMints);

    // Step 4: Save to DB
    const totalWallets = saveWallets(wallets);

    // Done
    db.prepare(`UPDATE pipeline_runs SET status = 'success', ended_at = datetime('now') WHERE id = ?`).run(runId);
    log(`Discovery complete! ${totalWallets} total Seeker wallets in database.`, "success");
  } catch (e) {
    log(`Fatal error: ${e.message}`, "error");
    console.error(e.stack);
    db.prepare(`UPDATE pipeline_runs SET status = 'error', ended_at = datetime('now') WHERE id = ?`).run(runId);
  } finally {
    db.close();
  }
}

main();
