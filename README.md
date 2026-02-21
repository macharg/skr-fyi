# ⚡ skr.fyi

Real-time analytics dashboard for the Solana Seeker ecosystem — tracking 100K+ Seeker device owners, their on-chain activity, holdings, dApp usage, and the SKR economy.

![License](https://img.shields.io/badge/license-MIT-green)
![Solana](https://img.shields.io/badge/Solana-Seeker-purple)

## What is this?

skr.fyi aggregates on-chain data from all Solana Seeker phone owners (identified via their soulbound Seeker Genesis Tokens) and presents it in a live dashboard. Think of it as Dune Analytics, but purpose-built for the Seeker ecosystem.

### Metrics tracked

- **Devices & Wallets** — total SGT holders, daily active wallets, new activations
- **On-Chain Activity** — daily transactions, swap volume, failed tx rate
- **Holdings** — aggregate portfolio value, token distribution, SOL/SKR balances
- **dApp Ecosystem** — protocol usage rankings, category breakdown, developer stats
- **SKR Economy** — price, market cap, staking rate, tokenomics, airdrop stats

## Architecture

```
skr-fyi/
├── app/                  # Next.js frontend (Vercel)
│   ├── src/
│   │   ├── components/   # Dashboard React components
│   │   ├── lib/          # Data fetching & formatting
│   │   └── hooks/        # React hooks for data
│   └── public/
├── pipeline/             # Node.js data pipeline
│   ├── scripts/          # Collection & aggregation scripts
│   ├── config/           # Shared config & API helpers
│   └── cron/             # Production scheduling
└── data/                 # Shared output (dashboard.json)
```

**Data flow:**
```
Solana RPC (Helius) → Pipeline scripts → SQLite → dashboard.json → Next.js frontend
```

## Quick Start

### Prerequisites

- Node.js 20+
- A [Helius API key](https://dashboard.helius.dev) (free tier works)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/skr-fyi.git
cd skr-fyi
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
# Edit .env.local with your Helius API key
```

### 3. Run the pipeline

```bash
# Initialize database
npm run pipeline:init

# Discover all SGT holders (~5-10 min)
npm run pipeline:discover

# Collect daily snapshot
npm run pipeline:snapshot

# Scan activity
npm run pipeline:activity

# Generate dashboard.json
npm run pipeline:aggregate

# Or run everything:
npm run pipeline:full
```

### 4. Start the dashboard

```bash
npm run dev
# Open http://localhost:3000
```

## Deployment

### Frontend (Vercel)

Push to GitHub and connect to Vercel. The `app/` directory is auto-detected as a Next.js project.

```bash
# Or deploy manually
cd app && npx vercel
```

### Pipeline (VPS / Railway / Fly.io)

The pipeline runs on a schedule via cron. Deploy the Docker container:

```bash
cd pipeline
docker build -t skr-fyi-pipeline .
docker run -d --env-file ../.env.local skr-fyi-pipeline
```

See [`pipeline/README.md`](./pipeline/README.md) for full pipeline docs.

## Data Sources

| Source | Used for |
|--------|----------|
| [Helius RPC](https://helius.dev) | SGT discovery, balances, token accounts, enhanced TX parsing |
| [Jupiter Price API](https://docs.jup.ag/docs/apis/price-api-v2) | Real-time token prices |
| [CoinGecko](https://coingecko.com) | SKR market data (market cap, volume) |

## Key On-Chain Addresses

| Name | Address |
|------|---------|
| SGT Mint Authority | `GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4` |
| SGT Group/Metadata | `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te` |
| Token-2022 Program | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |

## Contributing

Contributions welcome! Some areas that need help:

- [ ] Dune SQL queries for historical data backfill
- [ ] Additional dApp protocol parsers
- [ ] SKR staking analytics (Guardian delegation tracking)
- [ ] Mobile-responsive dashboard improvements

## License

MIT — see [LICENSE](./LICENSE).
