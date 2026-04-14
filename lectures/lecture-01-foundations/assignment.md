# Assignment 1 — Wallet Dashboard

**Estimated time:** 60–90 minutes  
**Difficulty:** Beginner  

---

## Objective

Build a single-page wallet dashboard that connects to a Solana wallet and displays account information. No backend required — all data comes directly from the Solana RPC.

---

## Requirements

### Core (required for passing)

1. **Wallet connection button** with three visible states:
   - Disconnected: "Connect Wallet" button
   - Connecting: disabled button with loading indicator
   - Connected: truncated address (`First4...Last4`) + green dot + dropdown

2. **Dropdown menu** (when connected) with:
   - Copy address (with "Copied!" confirmation)
   - View on Solana Explorer (opens in new tab, respects devnet)
   - Disconnect

3. **SOL balance card** with:
   - Skeleton loading state
   - Error state with retry button
   - Formatted balance: `2.5000 SOL` (4 decimals, monospace font)
   - Refresh button

4. **Network indicator** — display which cluster you're connected to (devnet/mainnet)

### Stretch goals (for distinction)

5. **Auto-refresh** — re-fetch the balance every 30 seconds while the tab is visible (use `document.visibilityState`)
6. **Real-time subscription** — use `connection.onAccountChange()` instead of polling
7. **SOL price** — fetch the SOL/USD price from a free API (CoinGecko public endpoint) and show an estimated USD value below the SOL amount
8. **Airdrop button** — on devnet only, add a button that calls `connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL)` and shows the result

---

## Setup

```bash
pnpm create next-app@latest assignment-01 --typescript --tailwind --app
cd assignment-01
pnpm add @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @solana/wallet-adapter-base
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dropdown-menu badge sonner
```

---

## File Structure to Create

```
src/
├── app/
│   ├── layout.tsx           ← wrap with SolanaProvider
│   └── page.tsx             ← main dashboard
├── components/
│   ├── providers/
│   │   └── solana-provider.tsx
│   ├── wallet/
│   │   └── wallet-button.tsx
│   └── dashboard/
│       ├── sol-balance-card.tsx
│       └── network-badge.tsx
└── hooks/
    └── use-sol-balance.ts
```

---

## Grading Rubric

| Criterion | Points | Notes |
|-----------|--------|-------|
| Wallet connects and disconnects | 15 | All three states visible |
| Address displays truncated | 10 | `First4...Last4` format |
| Copy address works | 10 | With "Copied!" confirmation, 2 s timeout |
| Explorer link opens correctly | 10 | New tab, correct cluster |
| SOL balance loads | 15 | Correct conversion from lamports |
| Balance skeleton on load | 10 | No layout shift |
| Error state with retry | 10 | Visible, actionable |
| Network indicator | 5 | Shows current cluster |
| Code quality | 10 | No magic numbers, no hardcoded colors |
| No TypeScript errors | 5 | `pnpm build` must succeed |
| **Total** | **100** | |
| Auto-refresh (stretch) | +10 | Pauses when tab hidden |
| Real-time subscription (stretch) | +15 | Uses `onAccountChange` |
| USD price (stretch) | +10 | Correct conversion |
| Airdrop button (stretch) | +10 | Devnet only, handles errors |

---

## Submission

- Push to a public GitHub repo
- Include a `README.md` with your RPC endpoint choice and how to run it locally
- Deployed URL (Vercel free tier is fine) — optional but encouraged

---

## Common Pitfalls

- `useWallet()` returns `publicKey: null` when disconnected — guard every usage with a null check
- The wallet adapter needs `"use client"` in any file that imports its hooks
- `connection.getBalance()` returns lamports — divide by `LAMPORTS_PER_SOL` for display
- Don't create a new `Connection` inside component render — use `useConnection()`
- `requestAirdrop` can fail on rate limits — handle the error, show a toast
