// scripts/03-activity-scanner.js
// ─────────────────────────────────────────────────────────────────────────────
// Scans recent transaction activity for Seeker wallets:
//   1. Gets recent transaction signatures for sampled wallets
//   2. Uses Helius Enhanced TX API to parse transaction types
//   3. Categorizes by dApp / protocol
//   4. Tracks swap volume, active wallets, and interaction counts
// ─────────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import {
  DB_PATH, HELIUS_API_KEY, HELIUS_API_URL, HELIUS_RPC_URL,
  DEFI_PROGRAMS, WALLET_BATCH_SIZE,
  rpcCall, fetchWithRetry, getEnhancedTransactions, sleep, log, today,
} from "../config/index.js";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const runId = db.prepare(
  `INSERT INTO pipeline_runs (script, status) VALUES ('03-activity-scanner', 'running')`
).run().lastInsertRowid;

log("Starting activity scanner...", "start");

// Reverse lookup: program ID -> name & category
const PROGRAM_LOOKUP = {};
for (const [name, programId] of Object.entries(DEFI_PROGRAMS)) {
  const prettyName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let category = "DeFi";
  if (name.includes("JUPITER") || name.includes("RAYDIUM") || name.includes("ORCA"))
    category = "DEX";
  else if (name.includes("TENSOR")) category = "NFT";
  else if (name.includes("MARINADE")) category = "Staking";
  else if (name.includes("DRIFT")) category = "Perps";

  PROGRAM_LOOKUP[programId] = { name: prettyName, category };
}

// ─── Step 1: Sample active wallets ───────────────────────────────────────────

function loadWalletSample(sampleSize = 2000) {
  // For activity scanning, we sample wallets rather than scanning all 100K+
  // Prioritize recently active wallets, then random fill
  const recentlyActive = db.prepare(`
    SELECT wallet_address FROM seeker_wallets
    WHERE last_active >= date('now', '-7 days') AND is_active = 1
    ORDER BY last_active DESC
    LIMIT ?
  `).all(Math.floor(sampleSize * 0.6)).map((r) => r.wallet_address);

  const remaining = sampleSize - recentlyActive.length;
  const randomFill = db.prepare(`
    SELECT wallet_address FROM seeker_wallets
    WHERE is_active = 1 AND wallet_address NOT IN (${recentlyActive.map(() => "?").join(",") || "''"})
    ORDER BY RANDOM()
    LIMIT ?
  `).all(...recentlyActive, remaining).map((r) => r.wallet_address);

  const wallets = [...new Set([...recentlyActive, ...randomFill])];
  log(`Loaded ${wallets.length} wallets for activity scan (${recentlyActive.length} recently active + ${randomFill.length} random).`);
  return wallets;
}

// ─── Step 2: Fetch recent signatures for a wallet ────────────────────────────

async function getRecentSignatures(wallet, limit = 20) {
  const result = await rpcCall("getSignaturesForAddress", [
    wallet,
    { limit, commitment: "confirmed" },
  ]);
  return result || [];
}

// ─── Step 3: Parse transactions via Enhanced TX API ──────────────────────────

async function parseTransactions(signatures) {
  if (signatures.length === 0) return [];

  const data = await fetchWithRetry(
    `${HELIUS_API_URL}/v0/transactions?api-key=${HELIUS_API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({ transactions: signatures }),
    }
  );

  return Array.isArray(data) ? data : [];
}

// ─── Step 4: Scan and aggregate ──────────────────────────────────────────────

async function main() {
  const wallets = loadWalletSample();
  if (wallets.length === 0) {
    log("No wallets to scan. Run 01-discover first.", "error");
    return;
  }

  // Accumulators
  const activeWallets = new Set();
  let totalTxCount = 0;
  let swapCount = 0;
  let swapVolumeUsd = 0;
  const programInteractions = {}; // programId -> { wallets: Set, txCount, volumeUsd }

  // 24h cutoff (Unix timestamp)
  const cutoff24h = Math.floor(Date.now() / 1000) - 86400;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];

    try {
      // Get recent signatures
      const sigs = await getRecentSignatures(wallet, 30);

      // Filter to last 24 hours
      const recentSigs = sigs.filter((s) => s.blockTime && s.blockTime >= cutoff24h);

      if (recentSigs.length === 0) continue;

      activeWallets.add(wallet);
      totalTxCount += recentSigs.length;

      // Parse a subset via Enhanced TX API (to classify types)
      // Limit to 10 per wallet to manage API costs
      const sigsToparse = recentSigs.slice(0, 10).map((s) => s.signature);
      const parsed = await parseTransactions(sigsToparse);

      for (const tx of parsed) {
        // Track swaps
        if (tx.type === "SWAP") {
          swapCount++;

          // Estimate swap volume from token transfers
          if (tx.tokenTransfers?.length > 0) {
            // Use the first output transfer as a rough volume proxy
            // In production, you'd look up token prices at the time
            for (const transfer of tx.tokenTransfers) {
              if (transfer.tokenAmount && transfer.tokenAmount > 0) {
                // Rough USD estimation — would need price lookup per mint
                // For now, accumulate raw amounts; real USD calc in aggregation
              }
            }
          }

          // Track native SOL value if present
          if (tx.nativeTransfers) {
            for (const nt of tx.nativeTransfers) {
              if (nt.amount > 0) {
                // Will convert to USD in aggregation step
                swapVolumeUsd += nt.amount / 1e9; // In SOL for now
              }
            }
          }
        }

        // Track program / dApp interactions
        if (tx.accountData) {
          for (const acct of tx.accountData) {
            const programId = acct.account;
            if (PROGRAM_LOOKUP[programId]) {
              if (!programInteractions[programId]) {
                programInteractions[programId] = {
                  wallets: new Set(),
                  txCount: 0,
                  volumeUsd: 0,
                };
              }
              programInteractions[programId].wallets.add(wallet);
              programInteractions[programId].txCount++;
            }
          }
        }

        // Also check the source field from enhanced TX
        if (tx.source) {
          const sourceProgram = Object.entries(DEFI_PROGRAMS).find(
            ([name]) => tx.source?.toUpperCase().includes(name.replace(/_/g, ""))
          );
          if (sourceProgram) {
            const [, progId] = sourceProgram;
            if (!programInteractions[progId]) {
              programInteractions[progId] = { wallets: new Set(), txCount: 0, volumeUsd: 0 };
            }
            programInteractions[progId].wallets.add(wallet);
            programInteractions[progId].txCount++;
          }
        }
      }

      // Update last_active for this wallet
      db.prepare("UPDATE seeker_wallets SET last_active = ? WHERE wallet_address = ?")
        .run(today(), wallet);

    } catch (err) {
      // Log but don't halt
      if (i % 100 === 0) {
        log(`  Error scanning wallet ${i}: ${err.message}`, "warn");
      }
    }

    // Progress + rate limit
    if ((i + 1) % 100 === 0) {
      log(`  Scanned ${i + 1}/${wallets.length} wallets | Active: ${activeWallets.size} | Txns: ${totalTxCount}`);
      await sleep(300);
    } else {
      await sleep(50);
    }
  }

  // ─── Extrapolate from sample to full population ─────────────────────────

  const totalWallets = db.prepare("SELECT COUNT(*) as c FROM seeker_wallets WHERE is_active = 1").get().c;
  const scaleFactor = totalWallets / wallets.length;

  const estimatedActiveWallets = Math.round(activeWallets.size * scaleFactor);
  const estimatedTxCount = Math.round(totalTxCount * scaleFactor);
  const estimatedSwapCount = Math.round(swapCount * scaleFactor);

  log(`Raw results: ${activeWallets.size} active, ${totalTxCount} txns, ${swapCount} swaps`);
  log(`Extrapolated (×${scaleFactor.toFixed(1)}): ~${estimatedActiveWallets} active, ~${estimatedTxCount} txns`);

  // ─── Write to database ──────────────────────────────────────────────────

  // Update daily snapshot with activity data
  db.prepare(`
    UPDATE daily_snapshots SET
      active_wallets_24h = ?,
      total_transactions = ?,
      swap_count = ?,
      swap_volume_usd = ?
    WHERE date = ?
  `).run(estimatedActiveWallets, estimatedTxCount, estimatedSwapCount, swapVolumeUsd, today());

  // If no snapshot row exists yet, insert one
  db.prepare(`
    INSERT OR IGNORE INTO daily_snapshots (date, active_wallets_24h, total_transactions, swap_count)
    VALUES (?, ?, ?, ?)
  `).run(today(), estimatedActiveWallets, estimatedTxCount, estimatedSwapCount);

  // Write dApp interactions
  const upsertDapp = db.prepare(`
    INSERT INTO dapp_interactions (date, program_id, program_name, category, unique_wallets, tx_count, volume_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, program_id) DO UPDATE SET
      unique_wallets = excluded.unique_wallets,
      tx_count = excluded.tx_count,
      volume_usd = excluded.volume_usd
  `);

  const writeDapps = db.transaction(() => {
    let count = 0;
    for (const [programId, data] of Object.entries(programInteractions)) {
      const info = PROGRAM_LOOKUP[programId] || { name: programId.slice(0, 8), category: "Other" };
      const scaledWallets = Math.round(data.wallets.size * scaleFactor);
      const scaledTx = Math.round(data.txCount * scaleFactor);
      upsertDapp.run(
        today(), programId, info.name, info.category,
        scaledWallets, scaledTx, data.volumeUsd
      );
      count++;
    }
    return count;
  });

  const dappCount = writeDapps();
  log(`Wrote ${dappCount} dApp interaction records.`, "success");

  // Update pipeline run
  db.prepare(`
    UPDATE pipeline_runs SET finished_at = datetime('now'), status = 'success',
      records = ?, notes = ?
    WHERE id = ?
  `).run(totalTxCount, `${activeWallets.size} active wallets from ${wallets.length} sample`, runId);
}

main()
  .catch((err) => {
    log(`Fatal error: ${err.message}`, "error");
    console.error(err);
    db.prepare(`
      UPDATE pipeline_runs SET finished_at = datetime('now'), status = 'error', notes = ?
      WHERE id = ?
    `).run(err.message, runId);
    process.exit(1);
  })
  .finally(() => db.close());
