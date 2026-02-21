// config/index.js — Shared configuration and utilities
import { config } from "dotenv";
config();

// ─── Constants ───────────────────────────────────────────────────────────────

export const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
export const HELIUS_API_URL = process.env.HELIUS_API_URL || "https://api-mainnet.helius-rpc.com";
export const DB_PATH = process.env.DB_PATH || "./data/skr-fyi.db";

// Seeker Genesis Token addresses
export const SGT = {
  MINT_AUTHORITY: "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4",
  METADATA_ADDRESS: "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te",
  GROUP_MINT_ADDRESS: "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te",
};

// Token-2022 Program ID (used by SGT)
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

// Well-known token mints for categorization
export const KNOWN_TOKENS = {
  SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  // SKR mint — verify this on-chain, placeholder below
  SKR: "SKRbvoCFESqKTv5i3VYcDWtRA7NgrPYskmcLE4ZhW3",
};

// Known DeFi program IDs for categorizing transactions
export const DEFI_PROGRAMS = {
  JUPITER_V6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  RAYDIUM_AMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  RAYDIUM_CLMM: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  ORCA_WHIRLPOOL: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  MARINADE: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
  TENSOR: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN",
  DRIFT: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  KAMINO_LEND: "KLend2g3cP87ber8cJv48MUNMWnG8qGPjp3QW3FsN99",
};

// Pipeline settings
export const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "10");
export const WALLET_BATCH_SIZE = parseInt(process.env.WALLET_BATCH_SIZE || "100");
export const HOLDINGS_SAMPLE_SIZE = parseInt(process.env.HOLDINGS_SAMPLE_SIZE || "0");

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Rate-limited fetch with retry and exponential backoff
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`  ⏳ Rate limited, waiting ${(wait / 1000).toFixed(1)}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const wait = Math.pow(2, attempt) * 500;
      console.warn(`  ⚠️  Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
}

/**
 * Make a JSON-RPC call to Helius
 */
export async function rpcCall(method, params) {
  const data = await fetchWithRetry(HELIUS_RPC_URL, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `skr-fyi-${Date.now()}`,
      method,
      params,
    }),
  });

  if (data.error) {
    throw new Error(`RPC Error [${method}]: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Helius DAS API call (getTokenAccounts, searchAssets, etc.)
 */
export async function dasCall(method, params) {
  const data = await fetchWithRetry(HELIUS_RPC_URL, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `das-${Date.now()}`,
      method,
      params,
    }),
  });

  if (data.error) {
    throw new Error(`DAS Error [${method}]: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Helius Enhanced Transactions API
 */
export async function getEnhancedTransactions(address, options = {}) {
  const params = new URLSearchParams({ "api-key": HELIUS_API_KEY });
  if (options.type) params.append("type", options.type);
  if (options.before) params.append("before", options.before);
  if (options.limit) params.append("limit", options.limit.toString());

  const url = `${HELIUS_API_URL}/v0/addresses/${address}/transactions?${params}`;
  return fetchWithRetry(url);
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatches(items, batchSize, processFn, delayMs = 200) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }

    const progress = Math.min(i + batchSize, items.length);
    if (progress % (batchSize * 10) === 0 || progress === items.length) {
      console.log(`  📊 Progress: ${progress}/${items.length} (${((progress / items.length) * 100).toFixed(1)}%)`);
    }
  }
  return results;
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function today() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Console logger with timestamps
 */
export function log(msg, level = "info") {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const icons = { info: "ℹ️ ", warn: "⚠️ ", error: "❌", success: "✅", start: "🚀" };
  console.log(`[${ts}] ${icons[level] || ""} ${msg}`);
}
