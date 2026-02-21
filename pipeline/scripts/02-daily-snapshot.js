// scripts/02-daily-snapshot.js
// ─────────────────────────────────────────────────────────────────────────────
// Collects daily aggregate data for all Seeker wallets:
//   1. SOL balances for all wallets (batched via getMultipleAccounts)
//   2. Token holdings for sampled/all wallets (via getTokenAccountsByOwner)
//   3. SKR price & market data (via Jupiter Price API)
//   4. Writes daily snapshot row + updates wallet_holdings table
// ─────────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import {
  DB_PATH, HELIUS_RPC_URL, HELIUS_API_KEY, KNOWN_TOKENS,
  HOLDINGS_SAMPLE_SIZE, WALLET_BATCH_SIZE,
  rpcCall, dasCall, fetchWithRetry, processBatches, sleep, log, today,
} from "../config/index.js";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const runId = db.prepare(
  `INSERT INTO pipeline_runs (script, status) VALUES ('02-daily-snapshot', 'running')`
).run().lastInsertRowid;

log("Starting daily snapshot collection...", "start");

// ─── Step 1: Load wallet list ────────────────────────────────────────────────

function loadWallets() {
  let query = "SELECT wallet_address FROM seeker_wallets WHERE is_active = 1";
  let wallets = db.prepare(query).all().map((r) => r.wallet_address);

  log(`Loaded ${wallets.length} active wallets from database.`);

  // Sample if configured (useful for free tier)
  if (HOLDINGS_SAMPLE_SIZE > 0 && wallets.length > HOLDINGS_SAMPLE_SIZE) {
    // Shuffle and take sample
    for (let i = wallets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wallets[i], wallets[j]] = [wallets[j], wallets[i]];
    }
    wallets = wallets.slice(0, HOLDINGS_SAMPLE_SIZE);
    log(`Sampling ${HOLDINGS_SAMPLE_SIZE} wallets for holdings scan.`);
  }

  return wallets;
}

// ─── Step 2: Batch-fetch SOL balances ────────────────────────────────────────

async function fetchSolBalances(wallets) {
  log("Fetching SOL balances...");

  const balances = new Map();
  const batchSize = 100; // getMultipleAccounts limit

  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);

    const result = await rpcCall("getMultipleAccounts", [
      batch,
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);

    if (result?.value) {
      result.value.forEach((account, idx) => {
        const lamports = account?.lamports || 0;
        balances.set(batch[idx], lamports / 1e9); // Convert to SOL
      });
    }

    if ((i / batchSize) % 20 === 0) {
      log(`  SOL balances: ${Math.min(i + batchSize, wallets.length)}/${wallets.length}`);
    }
    await sleep(100);
  }

  return balances;
}

// ─── Step 3: Fetch token holdings per wallet ─────────────────────────────────

async function fetchTokenHoldings(wallets) {
  log("Fetching token holdings for wallets...");

  const allHoldings = [];

  // Process in smaller batches with delays to respect rate limits
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];

    try {
      // Use Helius DAS getTokenAccounts for comprehensive token list
      const result = await dasCall("getTokenAccounts", {
        owner: wallet,
        limit: 100,
      });

      if (result?.token_accounts) {
        for (const account of result.token_accounts) {
          if (account.amount > 0) {
            allHoldings.push({
              wallet,
              mint: account.mint,
              amount: account.amount,
            });
          }
        }
      }
    } catch (err) {
      // Skip wallets that error, don't halt pipeline
      if (i % 500 === 0) {
        log(`  ⚠️  Error fetching ${wallet}: ${err.message}`, "warn");
      }
    }

    // Progress & rate limiting
    if ((i + 1) % 200 === 0) {
      log(`  Token holdings: ${i + 1}/${wallets.length} wallets processed`);
      await sleep(500);
    } else if ((i + 1) % 10 === 0) {
      await sleep(50);
    }
  }

  return allHoldings;
}

// ─── Step 4: Fetch token prices ──────────────────────────────────────────────

async function fetchTokenPrices(mints) {
  log("Fetching token prices from Jupiter...");

  const prices = {};
  const uniqueMints = [...new Set(mints)];

  // Jupiter supports batch price queries (up to ~100 at a time)
  const batchSize = 100;
  for (let i = 0; i < uniqueMints.length; i += batchSize) {
    const batch = uniqueMints.slice(i, i + batchSize);
    const ids = batch.join(",");

    try {
      const data = await fetchWithRetry(
        `https://api.jup.ag/price/v2?ids=${ids}`
      );

      if (data?.data) {
        for (const [mint, info] of Object.entries(data.data)) {
          if (info?.price) {
            prices[mint] = parseFloat(info.price);
          }
        }
      }
    } catch (err) {
      log(`  Price fetch error for batch: ${err.message}`, "warn");
    }

    await sleep(200);
  }

  log(`  Fetched prices for ${Object.keys(prices).length} tokens.`);
  return prices;
}

// ─── Step 5: Fetch SKR-specific metrics ──────────────────────────────────────

async function fetchSkrMetrics() {
  log("Fetching SKR token metrics...");

  const metrics = {
    price: 0,
    marketCap: 0,
    volume24h: 0,
    circulatingSupply: 0,
    totalStaked: 0,
    stakedPct: 0,
    holdersCount: 0,
  };

  try {
    // Price from Jupiter
    const priceData = await fetchWithRetry(
      `https://api.jup.ag/price/v2?ids=${KNOWN_TOKENS.SKR}`
    );
    if (priceData?.data?.[KNOWN_TOKENS.SKR]) {
      metrics.price = parseFloat(priceData.data[KNOWN_TOKENS.SKR].price || 0);
    }

    // Try CoinGecko for market cap / volume (free API)
    try {
      const cgData = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/coins/seeker?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (cgData?.market_data) {
        metrics.marketCap = cgData.market_data.market_cap?.usd || 0;
        metrics.volume24h = cgData.market_data.total_volume?.usd || 0;
        metrics.circulatingSupply = cgData.market_data.circulating_supply || 0;
      }
    } catch {
      log("  CoinGecko fetch failed, using Jupiter price only.", "warn");
    }
  } catch (err) {
    log(`  SKR metrics error: ${err.message}`, "warn");
  }

  return metrics;
}

// ─── Step 6: Compute aggregates & write to DB ────────────────────────────────

async function main() {
  const wallets = loadWallets();
  if (wallets.length === 0) {
    log("No wallets found. Run 01-discover-sgt-wallets.js first.", "error");
    return;
  }

  // Fetch SOL balances
  const solBalances = await fetchSolBalances(wallets);
  const totalSolHeld = [...solBalances.values()].reduce((a, b) => a + b, 0);
  log(`Total SOL held by Seeker wallets: ${totalSolHeld.toFixed(2)} SOL`);

  // Fetch token holdings
  const holdings = await fetchTokenHoldings(wallets);
  log(`Collected ${holdings.length} token holding records.`);

  // Get unique mints and fetch prices
  const uniqueMints = [...new Set(holdings.map((h) => h.mint))];
  const prices = await fetchTokenPrices(uniqueMints);

  // Fetch SKR metrics
  const skrMetrics = await fetchSkrMetrics();
  const solPrice = prices[KNOWN_TOKENS.SOL] || 0;

  // ─── Compute per-token aggregates ──────────────────────────────────────

  const tokenAgg = {}; // mint -> { symbol, totalAmount, totalValueUsd }
  for (const h of holdings) {
    if (!tokenAgg[h.mint]) {
      tokenAgg[h.mint] = { amount: 0, valueUsd: 0 };
    }
    tokenAgg[h.mint].amount += h.amount;
    const price = prices[h.mint] || 0;
    tokenAgg[h.mint].valueUsd += h.amount * price;
  }

  // Total portfolio value (including SOL)
  const tokenValueUsd = Object.values(tokenAgg).reduce((a, b) => a + b.valueUsd, 0);
  const solValueUsd = totalSolHeld * solPrice;
  const totalValueUsd = tokenValueUsd + solValueUsd;

  log(`Total portfolio value: $${(totalValueUsd / 1e6).toFixed(2)}M`);

  // ─── Write wallet_holdings table ───────────────────────────────────────

  const upsertHolding = db.prepare(`
    INSERT INTO wallet_holdings (wallet_address, token_mint, token_symbol, amount, value_usd, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(wallet_address, token_mint) DO UPDATE SET
      amount = excluded.amount,
      value_usd = excluded.value_usd,
      updated_at = datetime('now')
  `);

  // Resolve symbols for known tokens
  const mintToSymbol = Object.fromEntries(
    Object.entries(KNOWN_TOKENS).map(([sym, mint]) => [mint, sym])
  );

  const writeHoldings = db.transaction(() => {
    let count = 0;
    for (const h of holdings) {
      const price = prices[h.mint] || 0;
      upsertHolding.run(
        h.wallet,
        h.mint,
        mintToSymbol[h.mint] || null,
        h.amount,
        h.amount * price
      );
      count++;
    }
    return count;
  });

  const holdingsWritten = writeHoldings();
  log(`Wrote ${holdingsWritten} holding records.`);

  // ─── Write daily snapshot ──────────────────────────────────────────────

  const totalHolders = db.prepare("SELECT COUNT(*) as c FROM seeker_wallets").get().c;

  db.prepare(`
    INSERT INTO daily_snapshots (
      date, total_sgt_holders, total_sol_held, total_value_usd,
      skr_price, skr_market_cap, skr_staked_pct, sol_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_sgt_holders = excluded.total_sgt_holders,
      total_sol_held = excluded.total_sol_held,
      total_value_usd = excluded.total_value_usd,
      skr_price = excluded.skr_price,
      skr_market_cap = excluded.skr_market_cap,
      skr_staked_pct = excluded.skr_staked_pct,
      sol_price = excluded.sol_price
  `).run(
    today(),
    totalHolders,
    totalSolHeld,
    totalValueUsd,
    skrMetrics.price,
    skrMetrics.marketCap,
    skrMetrics.stakedPct,
    solPrice
  );

  // ─── Write SKR metrics ────────────────────────────────────────────────

  db.prepare(`
    INSERT INTO skr_metrics (date, price, market_cap, volume_24h, circulating_supply, holders_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      price = excluded.price,
      market_cap = excluded.market_cap,
      volume_24h = excluded.volume_24h,
      circulating_supply = excluded.circulating_supply,
      holders_count = excluded.holders_count
  `).run(
    today(),
    skrMetrics.price,
    skrMetrics.marketCap,
    skrMetrics.volume24h,
    skrMetrics.circulatingSupply,
    skrMetrics.holdersCount
  );

  log("Daily snapshot written.", "success");

  // Update pipeline run
  db.prepare(`
    UPDATE pipeline_runs SET finished_at = datetime('now'), status = 'success', records = ?
    WHERE id = ?
  `).run(holdingsWritten, runId);
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
