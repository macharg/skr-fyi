// scripts/test-connection.js — Diagnostic script to verify pipeline connectivity
// Run with: node scripts/test-connection.js

import { config } from "dotenv";
config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SGT_GROUP_MINT = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";

console.log("=================================================");
console.log("  skr.fyi Pipeline Diagnostic Test");
console.log("=================================================");
console.log(`  Time:    ${new Date().toISOString()}`);
console.log(`  API Key: ${HELIUS_API_KEY ? HELIUS_API_KEY.slice(0, 8) + "..." : "MISSING!"}`);
console.log(`  RPC URL: ${HELIUS_RPC_URL.replace(HELIUS_API_KEY || "", "***")}`);
console.log("");

if (!HELIUS_API_KEY) {
  console.error("ERROR: HELIUS_API_KEY environment variable is not set!");
  console.error("Set it in Railway Variables or in a .env file");
  process.exit(1);
}

async function rpcCall(method, params) {
  const res = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function heliusApi(endpoint, body) {
  const url = `https://api.helius.xyz/v0/${endpoint}?api-key=${HELIUS_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Helius API HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Test 1: Basic RPC connectivity ───────────────────────────────────────────
async function testRPC() {
  console.log("TEST 1: Basic RPC Connection");
  try {
    const slot = await rpcCall("getSlot", []);
    console.log(`  ✅ Connected! Current slot: ${slot}`);
    return true;
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`);
    return false;
  }
}

// ── Test 2: Look up SGT Group Mint info ──────────────────────────────────────
async function testSGTMint() {
  console.log("\nTEST 2: SGT Group Mint Account");
  try {
    const info = await rpcCall("getAccountInfo", [
      SGT_GROUP_MINT,
      { encoding: "jsonParsed" },
    ]);
    if (info && info.value) {
      console.log(`  ✅ SGT Group Mint exists!`);
      console.log(`  Owner: ${info.value.owner}`);
      console.log(`  Lamports: ${info.value.lamports}`);
      console.log(`  Data length: ${info.value.data?.length || "parsed"}`);
      return true;
    } else {
      console.log(`  ⚠️  Account not found — address may be wrong`);
      return false;
    }
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`);
    return false;
  }
}

// ── Test 3: Look up SKR token info ───────────────────────────────────────────
async function testSKRMint() {
  console.log("\nTEST 3: SKR Token Mint");
  try {
    const info = await rpcCall("getAccountInfo", [
      SKR_MINT,
      { encoding: "jsonParsed" },
    ]);
    if (info && info.value) {
      const parsed = info.value.data?.parsed;
      console.log(`  ✅ SKR Token exists!`);
      console.log(`  Owner program: ${info.value.owner}`);
      if (parsed?.info) {
        console.log(`  Supply: ${parsed.info.supply}`);
        console.log(`  Decimals: ${parsed.info.decimals}`);
      }
      return true;
    } else {
      console.log(`  ⚠️  Account not found`);
      return false;
    }
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`);
    return false;
  }
}

// ── Test 4: Find SGT holders using Helius DAS API ────────────────────────────
async function testFindSGTHolders() {
  console.log("\nTEST 4: Find SGT Holders (via Helius DAS API)");
  try {
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "searchAssets",
        params: {
          grouping: ["collection", SGT_GROUP_MINT],
          page: 1,
          limit: 10,
        },
      }),
    });
    const data = await res.json();
    
    if (data.error) {
      console.log(`  ⚠️  DAS API error: ${JSON.stringify(data.error)}`);
      
      // Try alternative: getAssetsByGroup
      console.log("  Trying getAssetsByGroup instead...");
      const res2 = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAssetsByGroup",
          params: {
            groupKey: "collection",
            groupValue: SGT_GROUP_MINT,
            page: 1,
            limit: 10,
          },
        }),
      });
      const data2 = await res2.json();
      
      if (data2.result && data2.result.items) {
        const items = data2.result.items;
        console.log(`  ✅ Found ${data2.result.total} total SGT assets!`);
        console.log(`  Showing first ${items.length}:`);
        items.forEach((item, i) => {
          const owner = item.ownership?.owner || "unknown";
          console.log(`    ${i + 1}. Mint: ${item.id?.slice(0, 12)}... Owner: ${owner.slice(0, 12)}...`);
        });
        return items;
      } else if (data2.error) {
        console.log(`  ⚠️  getAssetsByGroup error: ${JSON.stringify(data2.error)}`);
      }
      return null;
    }
    
    if (data.result && data.result.items) {
      const items = data.result.items;
      console.log(`  ✅ Found ${data.result.total} total SGT assets!`);
      console.log(`  Showing first ${items.length}:`);
      items.forEach((item, i) => {
        const owner = item.ownership?.owner || "unknown";
        console.log(`    ${i + 1}. Mint: ${item.id?.slice(0, 12)}... Owner: ${owner.slice(0, 12)}...`);
      });
      return items;
    }
    
    console.log(`  ⚠️  No results found. Response: ${JSON.stringify(data).slice(0, 200)}`);
    return null;
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`);
    return null;
  }
}

// ── Test 5: Get token balances for a discovered wallet ───────────────────────
async function testWalletBalances(walletAddress) {
  console.log(`\nTEST 5: Wallet Balances for ${walletAddress.slice(0, 12)}...`);
  try {
    // SOL balance
    const solBal = await rpcCall("getBalance", [walletAddress]);
    console.log(`  SOL: ${(solBal.value / 1e9).toFixed(4)}`);

    // Token balances via Helius parsed
    const tokens = await rpcCall("getTokenAccountsByOwner", [
      walletAddress,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]);
    
    if (tokens.value && tokens.value.length > 0) {
      console.log(`  SPL Tokens: ${tokens.value.length} accounts`);
      tokens.value.slice(0, 5).forEach((t) => {
        const info = t.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString || info.tokenAmount.amount;
        console.log(`    ${info.mint.slice(0, 12)}... → ${amount}`);
      });
    }

    // Also check Token-2022 accounts (SGT uses this)
    const t22 = await rpcCall("getTokenAccountsByOwner", [
      walletAddress,
      { programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" },
      { encoding: "jsonParsed" },
    ]);
    
    if (t22.value && t22.value.length > 0) {
      console.log(`  Token-2022 accounts: ${t22.value.length}`);
      t22.value.slice(0, 5).forEach((t) => {
        const info = t.account.data.parsed.info;
        const amount = info.tokenAmount.uiAmountString || info.tokenAmount.amount;
        console.log(`    ${info.mint.slice(0, 12)}... → ${amount}`);
      });
    }

    return true;
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`);
    return false;
  }
}

// ── Run all tests ────────────────────────────────────────────────────────────
async function main() {
  try {
    const rpcOk = await testRPC();
    if (!rpcOk) {
      console.error("\n💀 Cannot connect to Helius RPC. Check your API key.");
      process.exit(1);
    }

    await testSGTMint();
    await testSKRMint();
    
    const holders = await testFindSGTHolders();
    
    if (holders && holders.length > 0) {
      const firstOwner = holders[0].ownership?.owner;
      if (firstOwner) {
        await testWalletBalances(firstOwner);
      }
    }

    console.log("\n=================================================");
    console.log("  Diagnostic complete!");
    console.log("=================================================");
  } catch (e) {
    console.error(`\n💀 Unexpected error: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
