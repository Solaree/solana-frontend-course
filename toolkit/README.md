# Developer Toolkit — Solana Frontend Course

Plug-and-play templates for Colosseum Hackathon participants. Clone, install, and build.

---

## Templates

### `starter-template` — Full dApp Scaffold

**GitHub:** `https://github.com/veuxsu/solana-frontend-course/tree/main/toolkit/starter-template`

Everything a hackathon team needs on day one:

| What | How |
|------|-----|
| Wallet connection | Phantom, Solflare, Torus — `@solana/wallet-adapter` |
| Global wallet state | Zustand store (`src/store/wallet.ts`) — runtime state + persisted slippage preference |
| Live SOL balance | WebSocket subscription + React Query fallback |
| SPL token list | All non-zero accounts, sorted by balance, with USD prices |
| Transaction history | Recent signatures with timestamps, status, explorer links |
| Send SOL | Validated form (zod + react-hook-form), simulation preview, priority fee toggle |
| Token swap | Jupiter Quote & Swap API — proxied server-side (mainnet-beta only) |
| Token prices | Jupiter V3 Price API — proxied server-side |
| Devnet airdrop | One-click airdrop via server-side multi-endpoint retry |
| RPC proxy | `/api/rpc` with `ALLOWED_METHODS` gate — keeps API keys server-side |
| Wallet switch | Auto-clears React Query cache on wallet change |
| Error states | ErrorBoundary + per-component retry |
| Dark theme | WCAG AA, Solana purple accent |

**Quick start — 3 commands:**

```bash
cd toolkit/starter-template
npm install --legacy-peer-deps
cp .env.example .env.local # Set Helius API key
npm run dev
```

**[Full documentation →](./starter-template/README.md)**

---

## Directory layout

```
toolkit/
├── README.md                       ← you are here
└── starter-template/
    ├── README.md                   ← GitHub-ready setup guide
    ├── .env.example                ← documented env vars (safe to commit)
    ├── .gitignore                  ← excludes node_modules, .env.local, .next
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── api/
        │   │   ├── rpc/route.ts        ← RPC proxy (keeps HELIUS_API_KEY server-side)
        │   │   ├── airdrop/route.ts    ← Devnet airdrop (multi-endpoint retry)
        │   │   ├── prices/route.ts     ← Jupiter V3 Price API proxy
        │   │   └── swap/
        │   │       ├── route.ts        ← Jupiter swap execution proxy
        │   │       └── quote/route.ts  ← Jupiter quote proxy
        │   ├── layout.tsx, page.tsx, globals.css
        ├── components/
        │   ├── providers/          ← SolanaProvider, QueryProvider, WalletSync (Zustand bridge)
        │   ├── wallet/             ← WalletButton, AirdropButton
        │   ├── portfolio/          ← SolBalanceCard, TokenList, TransactionHistory
        │   ├── transactions/       ← SendSolForm, SwapForm (Jupiter)
        │   └── ui/                 ← Address, ClusterBadge, ErrorBoundary, RefreshButton, TokenIcon
        ├── hooks/                  ← useSolBalance, useTokenAccounts, useSendTransaction,
        │                              useSwap, useTransactionHistory, useWalletCacheClear, useTokenPrices
        ├── store/
        │   └── wallet.ts           ← Zustand: runtime wallet state + persisted user preferences
        └── lib/                    ← format.ts, jupiter.ts, solana.ts, utils.ts
```

---

## Pushing to GitHub (for judges)

```bash
# From the repo root
git init
git add .
git commit -m "feat: solana frontend course + starter template"
git remote add origin https://github.com/YOUR_ORG/solana-frontend-course.git
git push -u origin main
```

> `node_modules/`, `.next/`, and `.env.local` are excluded by `.gitignore` — safe to push as-is.

---

## Lecture resources

Each lecture links to the starter template and extends it:

| Lecture | Template connection |
|---------|-------------------|
| [01 — Foundations](../lectures/lecture-01-foundations/) | Builds `SolanaProvider` + `WalletButton` from scratch |
| [02 — Reading State](../lectures/lecture-02-reading-state/) | Adds `useTokenAccounts`, React Query, subscriptions |
| [03 — Transactions](../lectures/lecture-03-transactions/) | Adds `SendSolForm`, priority fees, simulation |
| [04 — Production](../lectures/lecture-04-production/) | Adds RPC proxy, ErrorBoundary, security hardening |
