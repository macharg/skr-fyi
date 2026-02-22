// scripts/test-connection.js — v3: Discover SGTs via mint authority transactions
import { config } from "dotenv";
config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";

console.log("=================================================");
console.log("  skr.fyi — SGT Wallet Discovery v3");
console.log("=================================================");
console.log(`  Time: ${new Date().toISOString()}`);
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

// Step 1: Get recent transaction signatures for the mint authority
async function getRecentMintTxs(limit = 20) {
  console.log(`STEP 1: Fetching last ${limit} transactions for mint authority...`);
  try {
    const sigs = await rpcCall("getSignaturesForAddress", [
      SGT_MINT_AUTHORITY,
      { limit },
    ]);
    console.log(`  ✅ Found ${sigs.length} transactions`);
    if (sigs.length > 0) {
      console.log(`  Latest: ${sigs[0].signature.slice(0, 20)}... (${new Date(sigs[0].blockTime * 1000).toISOString()})`);
      console.log(`  Oldest: ${sigs[sigs.length - 1].signature.slice(0, 20)}... (${new Date(sigs[sigs.length - 1].blockTime * 1000).toISOString()})`);
    }
    return sigs;
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
    return [];
  }
}

// Step 2: Parse a transaction to extract mint address and owner
async function parseMintTx(signature) {
  try {
    // Use Helius enhanced transaction parsing
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [signature] }),
    });
    const data = await res.json();

    if (data && data.length > 0) {
      const tx = data[0];
      return {
        signature: signature.slice(0, 16) + "...",
        type: tx.type,
        description: tx.description?.slice(0, 100),
        timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : "unknown",
        // Look for token transfers or mints
        tokenTransfers: tx.tokenTransfers || [],
        accountData: tx.accountData?.slice(0, 3) || [],
      };
    }
    return null;
  } catch (e) {
    console.error(`  Error parsing tx: ${e.message}`);
    return null;
  }
}

// Step 3: Use getAsset to get owner of an SGT mint
async function getAssetOwner(mintAddress) {
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });
    const data = await res.json();
    if (data.result) {
      return {
        mint: mintAddress,
        owner: data.result.ownership?.owner,
        frozen: data.result.ownership?.frozen,
        name: data.result.content?.metadata?.name,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Step 4: Alternative — use Helius parsed transaction history
async function getEnhancedHistory() {
  console.log(`\nSTEP 2: Using Helius Enhanced Transaction API...`);
  try {
    const url = `https://api.helius.xyz/v0/addresses/${SGT_MINT_AUTHORITY}/transactions?api-key=${HELIUS_API_KEY}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.length > 0) {
      console.log(`  ✅ Got ${data.length} enhanced transactions`);

      const sgtMints = new Set();

      for (const tx of data) {
        console.log(`\n  TX: ${tx.signature?.slice(0, 16)}...`);
        console.log(`    Type: ${tx.type}`);
        console.log(`    Time: ${tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : "unknown"}`);
        console.log(`    Description: ${tx.description?.slice(0, 120) || "none"}`);

        // Check token transfers for minted SGTs
        if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          console.log(`    Token transfers: ${tx.tokenTransfers.length}`);
          for (const tt of tx.tokenTransfers) {
            console.log(`      Mint: ${tt.mint} → To: ${tt.toUserAccount?.slice(0, 16)}... Amount: ${tt.tokenAmount}`);
            if (tt.mint && tt.mint !== "So11111111111111111111111111111111111111112") {
              sgtMints.add(tt.mint);
            }
          }
        }

        // Check account data for new accounts
        if (tx.accountData && tx.accountData.length > 0) {
          const newAccounts = tx.accountData.filter(a => a.nativeBalanceChange > 0);
          if (newAccounts.length > 0) {
            console.log(`    New accounts: ${newAccounts.length}`);
          }
        }
      }

      return sgtMints;
    } else {
      console.log(`  ⚠️ No transactions returned. Response: ${JSON.stringify(data).slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`);
  }
  return new Set();
}

// Step 5: Look up discovered SGT owners
async function lookupOwners(mintAddresses) {
  console.log(`\nSTEP 3: Looking up owners for ${mintAddresses.size} discovered SGT mints...`);
  const wallets = [];

  for (const mint of mintAddresses) {
    const asset = await getAssetOwner(mint);
    if (asset) {
      console.log(`  ✅ ${mint.slice(0, 16)}... → Owner: ${asset.owner?.slice(0, 16)}... (${asset.name})`);
      wallets.push(asset);
    } else {
      console.log(`  ⚠️ ${mint.slice(0, 16)}... → Could not resolve`);
    }
  }

  return wallets;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Verify connectivity
  const slot = await rpcCall("getSlot", []);
  console.log(`Connected to Solana! Slot: ${slot}\n`);

  // Get recent txs from mint authority
  await getRecentMintTxs(10);

  // Get enhanced transaction history
  const sgtMints = await getEnhancedHistory();

  // Look up owners
  if (sgtMints.size > 0) {
    const wallets = await lookupOwners(sgtMints);
    console.log(`\n=================================================`);
    console.log(`  RESULTS: Found ${wallets.length} SGT wallets!`);
    console.log(`=================================================`);
    wallets.forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.owner}`);
    });
  } else {
    console.log(`\n=================================================`);
    console.log(`  No SGT mints found in recent transactions.`);
    console.log(`  The mint authority may not have recent activity,`);
    console.log(`  or we need to paginate further back.`);
    console.log(`=================================================`);
  }
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
