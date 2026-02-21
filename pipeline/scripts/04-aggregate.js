// scripts/04-aggregate.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads from the SQLite database and produces a single dashboard.json file
// that the skr.fyi frontend consumes. This is the bridge between the
// data pipeline and the React dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { DB_PATH, KNOWN_TOKENS, log, today } from "../config/index.js";

const db = new Database(DB_PATH, { readonly: true });

log("Aggregating dashboard data...", "start");

// ─── 1. Overview Stats ───────────────────────────────────────────────────────

function getOverviewStats() {
  const latest = db.prepare(`
    SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 1
  `).get();

  const yesterday = db.prepare(`
    SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT 1 OFFSET 1
  `).get();

  const totalWallets = db.prepare(
    "SELECT COUNT(*) as c FROM seeker_wallets"
  ).get().c;

  // Calculate percentage changes
  const pctChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return {
    totalDevices: totalWallets,
    activeWallets24h: latest?.active_wallets_24h || 0,
    activeWalletsChange: pctChange(latest?.active_wallets_24h, yesterday?.active_wallets_24h),
    totalTransactions: latest?.total_transactions || 0,
    txChange: pctChange(latest?.total_transactions, yesterday?.total_transactions),
    totalValueUsd: latest?.total_value_usd || 0,
    valueChange: pctChange(latest?.total_value_usd, yesterday?.total_value_usd),
    totalSolHeld: latest?.total_sol_held || 0,
    skrPrice: latest?.skr_price || 0,
    skrMarketCap: latest?.skr_market_cap || 0,
    solPrice: latest?.sol_price || 0,
    skrStakedPct: latest?.skr_staked_pct || 0,
    lastUpdated: latest?.created_at || today(),
  };
}

// ─── 2. Daily Activity Time Series ──────────────────────────────────────────

function getDailyActivity(days = 90) {
  return db.prepare(`
    SELECT
      date,
      active_wallets_24h as activeWallets,
      total_transactions as transactions,
      swap_count as swapCount,
      swap_volume_usd as swapVolume,
      total_value_usd as totalValue,
      skr_price as skrPrice,
      sol_price as solPrice
    FROM daily_snapshots
    WHERE date >= date('now', ?)
    ORDER BY date ASC
  `).all(`-${days} days`);
}

// ─── 3. Token Holdings Distribution ─────────────────────────────────────────

function getHoldingsDistribution() {
  // Aggregate holdings by token mint
  const holdings = db.prepare(`
    SELECT
      token_mint as mint,
      token_symbol as symbol,
      SUM(amount) as totalAmount,
      SUM(value_usd) as totalValueUsd,
      COUNT(DISTINCT wallet_address) as holderCount
    FROM wallet_holdings
    WHERE value_usd > 0
    GROUP BY token_mint
    ORDER BY totalValueUsd DESC
    LIMIT 20
  `).all();

  // Calculate portfolio percentages
  const totalValue = holdings.reduce((a, h) => a + h.totalValueUsd, 0);

  // Map known token names and colors
  const tokenColors = {
    SOL: "#9945FF",
    SKR: "#14F195",
    USDC: "#2775CA",
    USDT: "#26A17B",
    JUP: "#FE7D44",
    BONK: "#F5A623",
    RAY: "#68D5F7",
  };

  const mintToSymbol = Object.fromEntries(
    Object.entries(KNOWN_TOKENS).map(([sym, mint]) => [mint, sym])
  );

  return holdings.map((h, i) => {
    const symbol = h.symbol || mintToSymbol[h.mint] || `Token ${i + 1}`;
    return {
      name: symbol,
      mint: h.mint,
      value: totalValue > 0 ? parseFloat(((h.totalValueUsd / totalValue) * 100).toFixed(1)) : 0,
      totalValueUsd: h.totalValueUsd,
      totalAmount: h.totalAmount,
      holderCount: h.holderCount,
      color: tokenColors[symbol] || `hsl(${(i * 40) % 360}, 60%, 55%)`,
    };
  });
}

// ─── 4. Top dApps ───────────────────────────────────────────────────────────

function getTopDapps() {
  // Get latest day's data, with 7-day comparison
  const latest = db.prepare(`
    SELECT
      program_id,
      program_name as name,
      category,
      unique_wallets as users,
      tx_count as txCount,
      volume_usd as volumeUsd
    FROM dapp_interactions
    WHERE date = (SELECT MAX(date) FROM dapp_interactions)
    ORDER BY unique_wallets DESC
    LIMIT 15
  `).all();

  // Get 7-day-ago data for comparison
  const weekAgo = db.prepare(`
    SELECT program_id, unique_wallets
    FROM dapp_interactions
    WHERE date = (SELECT MAX(date) FROM dapp_interactions WHERE date <= date('now', '-7 days'))
  `).all();

  const weekAgoMap = {};
  for (const d of weekAgo) {
    weekAgoMap[d.program_id] = d.unique_wallets;
  }

  return latest.map((d) => {
    const prev = weekAgoMap[d.program_id];
    const change = prev ? (((d.users - prev) / prev) * 100).toFixed(1) : null;
    return {
      ...d,
      change7d: change ? `${parseFloat(change) >= 0 ? "+" : ""}${change}%` : "new",
    };
  });
}

// ─── 5. dApp Category Breakdown ─────────────────────────────────────────────

function getCategoryBreakdown() {
  return db.prepare(`
    SELECT
      category,
      SUM(unique_wallets) as wallets,
      SUM(tx_count) as txCount
    FROM dapp_interactions
    WHERE date = (SELECT MAX(date) FROM dapp_interactions)
    GROUP BY category
    ORDER BY wallets DESC
  `).all().map((c) => {
    const totalWallets = db.prepare(`
      SELECT SUM(unique_wallets) as total FROM dapp_interactions
      WHERE date = (SELECT MAX(date) FROM dapp_interactions)
    `).get().total || 1;

    return {
      ...c,
      percentage: parseFloat(((c.wallets / totalWallets) * 100).toFixed(1)),
    };
  });
}

// ─── 6. SKR Economy Metrics ─────────────────────────────────────────────────

function getSkrMetrics() {
  const latest = db.prepare(`
    SELECT * FROM skr_metrics ORDER BY date DESC LIMIT 1
  `).get();

  const history = db.prepare(`
    SELECT date, price, market_cap, volume_24h, staked_pct
    FROM skr_metrics
    WHERE date >= date('now', '-90 days')
    ORDER BY date ASC
  `).all();

  return {
    current: latest || {},
    history,
  };
}

// ─── 7. Pipeline Health ─────────────────────────────────────────────────────

function getPipelineHealth() {
  return db.prepare(`
    SELECT script, status, started_at, finished_at, records
    FROM pipeline_runs
    ORDER BY started_at DESC
    LIMIT 10
  `).all();
}

// ─── Assemble & Write ───────────────────────────────────────────────────────

function main() {
  const dashboard = {
    generatedAt: new Date().toISOString(),
    overview: getOverviewStats(),
    dailyActivity: getDailyActivity(90),
    holdingsDistribution: getHoldingsDistribution(),
    topDapps: getTopDapps(),
    categoryBreakdown: getCategoryBreakdown(),
    skrEconomy: getSkrMetrics(),
    pipelineHealth: getPipelineHealth(),
  };

  // Write to shared data directory (consumed by frontend)
  const outputDir = process.env.DASHBOARD_OUTPUT
    ? dirname(process.env.DASHBOARD_OUTPUT)
    : "../data";
  mkdirSync(outputDir, { recursive: true });

  const outputPath = process.env.DASHBOARD_OUTPUT || "../data/dashboard.json";
  writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
  log(`Dashboard JSON written to ${outputPath}`, "success");

  // Also write locally for pipeline inspection
  mkdirSync("./data", { recursive: true });
  writeFileSync("./data/dashboard.json", JSON.stringify(dashboard, null, 2));

  // Minified version for production
  const minPath = outputPath.replace(".json", ".min.json");
  writeFileSync(minPath, JSON.stringify(dashboard));
  log(`Minified JSON written to ${minPath}`);

  // Print summary
  log(`\n📊 Dashboard Summary:`);
  log(`   Devices:     ${dashboard.overview.totalDevices.toLocaleString()}`);
  log(`   Active 24h:  ${dashboard.overview.activeWallets24h.toLocaleString()}`);
  log(`   Txns today:  ${dashboard.overview.totalTransactions.toLocaleString()}`);
  log(`   Value:       $${(dashboard.overview.totalValueUsd / 1e6).toFixed(2)}M`);
  log(`   SKR Price:   $${dashboard.overview.skrPrice}`);
  log(`   Data points: ${dashboard.dailyActivity.length} days of history`);
  log(`   Top dApps:   ${dashboard.topDapps.length} protocols tracked`);
  log(`   Tokens:      ${dashboard.holdingsDistribution.length} assets tracked`);
}

main();
db.close();
