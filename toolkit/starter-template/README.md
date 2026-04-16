# Solana Frontend Starter Template

A production-ready Next.js 15 dApp scaffold for the [Colosseum Hackathon](https://colosseum.org). Connect a wallet, read balances, and send SOL in under 5 minutes.

## What's included

| Feature | Implementation |
|---------|---------------|
| Wallet connection | Phantom, Solflare, Backpack via `@solana/wallet-adapter` |
| SOL balance | Live via WebSocket subscription — no polling |
| SPL token list | All non-zero token accounts, sorted by balance |
| Transaction history | Recent signatures with timestamps, status, explorer links |
| Send SOL | Form with validation, simulation preview, priority fee toggle |
| Token swap | Jupiter-powered swap with quote preview, slippage control, route display |
| Devnet airdrop | One-click airdrop via server-side multi-endpoint retry |
| RPC proxy | `/api/rpc` keeps API keys server-side (Lecture 4 security) |
| Wallet switch | Auto-clears React Query cache on wallet change |
| Error handling | Error boundary, per-component error states with retry |
| Loading states | Skeletons (no layout shift), min-duration refresh animation |
| Dark theme | Deep navy + Solana purple, WCAG AA contrast |
| RPC caching | React Query with 30s stale time and background refetch |

## Quick start

```bash
# 1. Clone or copy this directory
git clone https://github.com/veuxsu/solana-frontend-course
cd toolkit/starter-template

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — add your RPC URL

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect Phantom or Backpack, and you're live.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLUSTER` | No | `devnet` (default) or `mainnet-beta` |
| `NEXT_PUBLIC_RPC_URL` | No | RPC endpoint — defaults to public devnet. Set to `/api/rpc` in production. |
| `HELIUS_API_KEY` | No | Server-side only — powers `/api/rpc` proxy and `/api/airdrop` fallback |

Get a free Helius API key at [helius.dev](https://helius.dev).

> **Never commit `.env.local`** — it's in `.gitignore` by default.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── rpc/route.ts        # RPC proxy — keeps API keys server-side
│   │   └── airdrop/route.ts    # Devnet airdrop — multi-endpoint retry
│   ├── layout.tsx              # Providers: SolanaProvider, QueryProvider, ErrorBoundary
│   ├── page.tsx                # Main dashboard
│   └── globals.css             # Tailwind + CSS variables (dark theme)
├── components/
│   ├── providers/
│   │   ├── solana-provider.tsx # ConnectionProvider + WalletProvider
│   │   └── query-provider.tsx  # React Query setup
│   ├── wallet/
│   │   ├── wallet-button.tsx   # Connect/disconnect, copy, explorer link
│   │   └── airdrop-button.tsx  # One-click devnet airdrop
│   ├── portfolio/
│   │   ├── sol-balance-card.tsx
│   │   ├── token-list.tsx
│   │   └── transaction-history.tsx
│   ├── transactions/
│   │   ├── send-sol-form.tsx   # Validated form + simulation + priority fee
│   │   └── swap-form.tsx       # Jupiter token swap with quote + slippage
│   └── ui/
│       ├── address.tsx         # Truncated address + copy + explorer
│       ├── cluster-badge.tsx   # devnet/testnet indicator
│       ├── error-boundary.tsx  # Class component error boundary
│       └── refresh-button.tsx  # Smooth spin, guaranteed full rotation
├── hooks/
│   ├── use-sol-balance.ts      # React Query + WebSocket live subscription
│   ├── use-token-accounts.ts   # All SPL token accounts
│   ├── use-send-transaction.ts # Full tx lifecycle with status tracking
│   ├── use-swap.ts             # Jupiter quote + swap execution
│   ├── use-transaction-history.ts
│   ├── use-wallet-cache-clear.ts
│   └── use-account-subscription.ts
└── lib/
    ├── format.ts               # truncateAddress, formatTokenAmount, formatUsd, …
    ├── jupiter.ts              # Jupiter API constants, token list, types
    ├── solana.ts               # Connection singleton, cluster config
    └── utils.ts                # cn() Tailwind merge helper
```

## Extending the template

### Add a new program interaction

```ts
// src/lib/anchor.ts
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import myIdl from "./my_program.json";

export function getProgram(connection, wallet) {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(myIdl, provider);
}
```

```tsx
// In a component
const { connection } = useConnection();
const wallet = useWallet();
const program = getProgram(connection, wallet);
await program.methods.myInstruction(arg).accounts({ ... }).rpc();
```

### Switch to devnet

```bash
# .env.local
NEXT_PUBLIC_CLUSTER=devnet
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

The cluster badge disappears automatically on mainnet.

## Stack

- [Next.js 15](https://nextjs.org) — App Router, TypeScript
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) — RPC client
- [@solana/wallet-adapter](https://github.com/solana-labs/wallet-adapter) — wallet integration
- [@tanstack/react-query](https://tanstack.com/query) — RPC caching & background sync
- [react-hook-form](https://react-hook-form.com) + [zod](https://zod.dev) — form validation
- [sonner](https://sonner.emilkowal.ski) — toast notifications
- [lucide-react](https://lucide.dev) — icons

## License

MIT — use freely in your hackathon project.
