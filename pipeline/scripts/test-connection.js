// scripts/test-connection.js — Diagnostic v2: find SGT wallets
import { config } from "dotenv";
config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const SGT_GROUP_MINT = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

console.log("=================================================");
console.log("  skr.fyi Pipeline Diagnostic v2");
console.log("=================================================");
console.log(`  Time:    ${new Date().toISOString()}`);
console.log(`  API Key: ${HELIUS_API_KEY ? HELIUS_API_KEY.slice(0, 8) + "..." : "MISSING!"}`);
console.log("");

if (!HELIUS_API_KEY) {
  console.error("ERROR: HELIUS_API_KEY not set!");
  process.exit(1);
}

async function rpcCall(method, params) {
  const res = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  return data.result;
}

// ── Test 1: Basic connectivity ───────────────────────────────────────────────
async function test1() {
  console.log("TEST 1: RPC Connection");
  try {
    const slot = await rpcCall("getSlot", []);
    console.log(`  ✅ Connected! Slot: ${slot}`);
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
    process.exit(1);
  }
}

// ── Test 2: Verify SGT group mint exists ─────────────────────────────────────
async function test2() {
  console.log("\nTEST 2: SGT Group Mint");
  try {
    const info = await rpcCall("getAccountInfo", [SGT_GROUP_MINT, { encoding: "jsonParsed" }]);
    if (info?.value) {
      console.log(`  ✅ Exists! Owner: ${info.value.owner}`);
    } else {
      console.log("  ⚠️ Not found");
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
}

// ── Test 3: Check a known SGT mint from the docs ────────────────────────────
async function test3() {
  console.log("\nTEST 3: Known SGT Sample (from Solana Mobile docs)");
  const knownSGT = "5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj";
  try {
    const info = await rpcCall("getAccountInfo", [knownSGT, { encoding: "jsonParsed" }]);
    if (info?.value) {
      console.log(`  ✅ Known SGT exists!`);
      console.log(`  Owner program: ${info.value.owner}`);
      const parsed = info.value.data?.parsed;
      if (parsed?.info) {
        console.log(`  Mint authority: ${parsed.info.mintAuthority || "none"}`);
        console.log(`  Supply: ${parsed.info.supply}`);
        console.log(`  Decimals: ${parsed.info.decimals}`);
      }
    } else {
      console.log("  ⚠️ Not found");
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
}

// ── Test 4: Use searchAssets with authority ──────────────────────────────────
async function test4() {
  console.log("\nTEST 4: searchAssets by authority");
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "searchAssets",
        params: {
          authorityAddress: SGT_MINT_AUTHORITY,
          page: 1,
          limit: 5,
        },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log(`  ⚠️ Error: ${JSON.stringify(data.error)}`);
    } else if (data.result?.items?.length > 0) {
      console.log(`  ✅ Found ${data.result.total} assets!`);
      data.result.items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item.id} → owner: ${item.ownership?.owner?.slice(0, 16)}...`);
      });
      return data.result.items;
    } else {
      console.log(`  Found 0 assets. Full response: ${JSON.stringify(data.result).slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
  return null;
}

// ── Test 5: Use getAssetsByGroup ─────────────────────────────────────────────
async function test5() {
  console.log("\nTEST 5: getAssetsByGroup");
  try {
    const res = await fetch(HELIUS_RPC_URL, {
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
          limit: 5,
        },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log(`  ⚠️ Error: ${JSON.stringify(data.error)}`);
    } else if (data.result?.items?.length > 0) {
      console.log(`  ✅ Found ${data.result.total} assets!`);
      data.result.items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item.id} → owner: ${item.ownership?.owner?.slice(0, 16)}...`);
      });
      return data.result.items;
    } else {
      console.log(`  Found 0 assets. Response: ${JSON.stringify(data.result).slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
  return null;
}

// ── Test 6: Look up the known SGT via getAsset ──────────────────────────────
async function test6() {
  console.log("\nTEST 6: getAsset for known SGT");
  const knownSGT = "5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj";
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: knownSGT },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log(`  ⚠️ Error: ${JSON.stringify(data.error)}`);
    } else if (data.result) {
      const r = data.result;
      console.log(`  ✅ Asset found!`);
      console.log(`  Name: ${r.content?.metadata?.name || "unknown"}`);
      console.log(`  Owner: ${r.ownership?.owner}`);
      console.log(`  Frozen: ${r.ownership?.frozen}`);
      console.log(`  Interface: ${r.interface}`);
      console.log(`  Token standard: ${r.content?.metadata?.token_standard}`);
      if (r.grouping?.length > 0) {
        r.grouping.forEach(g => {
          console.log(`  Group: ${g.group_key} = ${g.group_value}`);
        });
      }
      if (r.authorities?.length > 0) {
        r.authorities.forEach(a => {
          console.log(`  Authority: ${a.address} (scopes: ${a.scopes?.join(",")})`);
        });
      }
      return r;
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
  return null;
}

// ── Test 7: Try getAssetsByAuthority ─────────────────────────────────────────
async function test7() {
  console.log("\nTEST 7: getAssetsByAuthority");
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAssetsByAuthority",
        params: {
          authorityAddress: SGT_MINT_AUTHORITY,
          page: 1,
          limit: 5,
        },
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log(`  ⚠️ Error: ${JSON.stringify(data.error)}`);
    } else if (data.result?.items?.length > 0) {
      console.log(`  ✅ Found ${data.result.total} assets by authority!`);
      data.result.items.forEach((item, i) => {
        console.log(`    ${i + 1}. ${item.id} → owner: ${item.ownership?.owner?.slice(0, 16)}...`);
      });
      return data.result.items;
    } else {
      console.log(`  Found 0 assets. Response: ${JSON.stringify(data.result).slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
  return null;
}

// ── Run all ──────────────────────────────────────────────────────────────────
async function main() {
  await test1();
  await test2();
  await test3();
  const t4 = await test4();
  const t5 = await test5();
  const t6 = await test6();
  const t7 = await test7();

  console.log("\n=================================================");
  console.log("  Summary");
  console.log("=================================================");
  console.log(`  searchAssets by authority: ${t4 ? "✅ found " + t4.length : "❌ none"}`);
  console.log(`  getAssetsByGroup:         ${t5 ? "✅ found " + t5.length : "❌ none"}`);
  console.log(`  getAsset (known SGT):     ${t6 ? "✅ found" : "❌ none"}`);
  console.log(`  getAssetsByAuthority:     ${t7 ? "✅ found " + t7.length : "❌ none"}`);
  console.log("=================================================");
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
