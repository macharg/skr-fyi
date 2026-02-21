import { DashboardData } from "./types";

// Generate 90 days of sample daily activity
const dailyActivity = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2025, 10, 23);
  d.setDate(d.getDate() + i);
  const base = 12000 + Math.sin(i / 7) * 3000 + i * 80;
  const spike = i > 58 && i < 65 ? 15000 : 0;
  return {
    date: d.toISOString().split("T")[0],
    activeWallets: Math.round((base + spike) * 0.35 + Math.random() * 800),
    transactions: Math.round(base + spike + Math.random() * 2000),
    swapCount: Math.round((base + spike) * 0.15),
    swapVolume: Math.round((base + spike) * 42 + Math.random() * 500000),
    totalValue: 1.2e9 + i * 3e6 + Math.random() * 20e6,
    skrPrice: 0.02 + Math.sin(i / 10) * 0.008 + Math.random() * 0.003,
    solPrice: 140 + Math.sin(i / 15) * 20 + Math.random() * 5,
  };
});

const sampleData: DashboardData = {
  generatedAt: new Date().toISOString(),

  overview: {
    totalDevices: 200000,
    activeWallets24h: 34280,
    activeWalletsChange: "8.4",
    totalTransactions: 142847,
    txChange: "11.2",
    totalValueUsd: 1.42e9,
    valueChange: "2.1",
    totalSolHeld: 4820000,
    skrPrice: 0.0209,
    skrMarketCap: 111.3e6,
    solPrice: 178.5,
    skrStakedPct: 68.2,
    lastUpdated: new Date().toISOString(),
  },

  dailyActivity,

  holdingsDistribution: [
    { name: "SOL", mint: "So11111111111111111111111111111111111111112", value: 42.3, totalValueUsd: 601e6, totalAmount: 4820000, holderCount: 98000, color: "#9945FF" },
    { name: "SKR", mint: "SKRbvoCFESqKTv5i3VYcDWtRA7NgrPYskmcLE4ZhW3", value: 18.7, totalValueUsd: 265e6, totalAmount: 3.24e9, holderCount: 85000, color: "#14F195" },
    { name: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", value: 15.2, totalValueUsd: 216e6, totalAmount: 216e6, holderCount: 62000, color: "#2775CA" },
    { name: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", value: 6.8, totalValueUsd: 96.6e6, totalAmount: 120e6, holderCount: 41000, color: "#FE7D44" },
    { name: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", value: 4.1, totalValueUsd: 58.2e6, totalAmount: 2.8e12, holderCount: 35000, color: "#F5A623" },
    { name: "RAY", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", value: 3.4, totalValueUsd: 48.3e6, totalAmount: 18e6, holderCount: 22000, color: "#68D5F7" },
    { name: "Other", mint: "other", value: 9.5, totalValueUsd: 134.9e6, totalAmount: 0, holderCount: 0, color: "#4A5568" },
  ],

  topDapps: [
    { program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", name: "Jupiter", category: "DEX", users: 67420, txCount: 245000, volumeUsd: 892e6, change7d: "+12.4%" },
    { program_id: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", name: "Raydium", category: "DEX", users: 48190, txCount: 156000, volumeUsd: 456e6, change7d: "+8.2%" },
    { program_id: "KLend2g3cP87ber8cJv48MUNMWnG8qGPjp3QW3FsN99", name: "Kamino", category: "DeFi", users: 34560, txCount: 89000, volumeUsd: 234e6, change7d: "+22.1%" },
    { program_id: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN", name: "Tensor", category: "NFT", users: 28340, txCount: 67000, volumeUsd: 156e6, change7d: "+5.7%" },
    { program_id: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD", name: "Marinade", category: "Staking", users: 22100, txCount: 34000, volumeUsd: 198e6, change7d: "+3.1%" },
    { program_id: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH", name: "Drift", category: "Perps", users: 19870, txCount: 78000, volumeUsd: 312e6, change7d: "+18.9%" },
    { program_id: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", name: "Orca", category: "DEX", users: 17650, txCount: 52000, volumeUsd: 178e6, change7d: "+6.3%" },
  ],

  categoryBreakdown: [
    { category: "DeFi", wallets: 38400, txCount: 145000, percentage: 38 },
    { category: "DEX", wallets: 28300, txCount: 210000, percentage: 28 },
    { category: "NFT/Gaming", wallets: 14100, txCount: 67000, percentage: 14 },
    { category: "Staking", wallets: 11100, txCount: 34000, percentage: 11 },
    { category: "DePIN", wallets: 5050, txCount: 12000, percentage: 5 },
    { category: "Other", wallets: 4040, txCount: 15000, percentage: 4 },
  ],

  skrEconomy: {
    current: {
      date: new Date().toISOString().split("T")[0],
      price: 0.0209,
      market_cap: 111.3e6,
      volume_24h: 17.6e6,
      circulating_supply: 5.33e9,
      total_staked: 3.64e9,
      staked_pct: 68.2,
      holders_count: 34020,
    },
    history: dailyActivity.slice(-30).map((d) => ({
      date: d.date,
      price: d.skrPrice,
      market_cap: d.skrPrice * 5.33e9,
      volume_24h: 10e6 + Math.random() * 15e6,
      staked_pct: 65 + Math.random() * 6,
    })),
  },

  pipelineHealth: [
    { script: "04-aggregate", status: "success", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), records: 7 },
    { script: "03-activity-scanner", status: "success", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), records: 142847 },
    { script: "02-daily-snapshot", status: "success", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), records: 98432 },
    { script: "01-discover-sgt-wallets", status: "success", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), records: 200000 },
  ],
};

export default sampleData;
