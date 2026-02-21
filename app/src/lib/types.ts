// Types matching the dashboard.json schema from the pipeline

export interface DashboardData {
  generatedAt: string;
  overview: OverviewStats;
  dailyActivity: DailyActivity[];
  holdingsDistribution: TokenHolding[];
  topDapps: DappEntry[];
  categoryBreakdown: CategoryEntry[];
  skrEconomy: SkrEconomy;
  pipelineHealth: PipelineRun[];
}

export interface OverviewStats {
  totalDevices: number;
  activeWallets24h: number;
  activeWalletsChange: string | null;
  totalTransactions: number;
  txChange: string | null;
  totalValueUsd: number;
  valueChange: string | null;
  totalSolHeld: number;
  skrPrice: number;
  skrMarketCap: number;
  solPrice: number;
  skrStakedPct: number;
  lastUpdated: string;
}

export interface DailyActivity {
  date: string;
  activeWallets: number;
  transactions: number;
  swapCount: number;
  swapVolume: number;
  totalValue: number;
  skrPrice: number;
  solPrice: number;
}

export interface TokenHolding {
  name: string;
  mint: string;
  value: number; // percentage of portfolio
  totalValueUsd: number;
  totalAmount: number;
  holderCount: number;
  color: string;
}

export interface DappEntry {
  program_id: string;
  name: string;
  category: string;
  users: number;
  txCount: number;
  volumeUsd: number;
  change7d: string;
}

export interface CategoryEntry {
  category: string;
  wallets: number;
  txCount: number;
  percentage: number;
}

export interface SkrEconomy {
  current: {
    date?: string;
    price?: number;
    market_cap?: number;
    volume_24h?: number;
    circulating_supply?: number;
    total_staked?: number;
    staked_pct?: number;
    holders_count?: number;
  };
  history: {
    date: string;
    price: number;
    market_cap: number;
    volume_24h: number;
    staked_pct: number;
  }[];
}

export interface PipelineRun {
  script: string;
  status: string;
  started_at: string;
  finished_at: string;
  records: number;
}
