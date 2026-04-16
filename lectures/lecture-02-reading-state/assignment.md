---
marp: true
---

# Assignment 2 — Token Portfolio Dashboard

**Estimated time:** 90–120 minutes  
**Difficulty:** Intermediate  

---

## Objective

Build a portfolio dashboard that displays a wallet's complete token holdings with real-time balance updates. Use React Query for data management and WebSocket subscriptions for live data.

---

## Requirements

### Core (required for passing)

1. **Token list** showing all non-zero SPL token balances:
   - Token mint address (truncated, with copy button)
   - Human-readable balance (formatted for size: K/M suffixes for large amounts)
   - Skeleton loading state while fetching (card-shaped, 4 rows)
   - Empty state: "No tokens yet" with description
   - Error state with retry
2. **SOL balance** with live subscription:
   - Use `connection.onAccountChange` (not polling)
   - Show a subtle "live" badge/indicator when subscribed
   - Balance updates without a page refresh when you send/receive SOL

---

3. **Transaction history** (last 10 signatures):
   - Signature truncated with link to explorer
   - Timestamp formatted as relative time ("2 minutes ago")
   - Error/slot indicator (success/fail badge)
4. **React Query** integration:
   - All RPC calls go through `useQuery`
   - Manual refresh button that calls `refetch()`
   - Show "last updated X seconds ago" timestamp

---

### Stretch goals

5. **Token metadata enrichment** — for each token in the list, fetch the symbol and logo from the Jupiter token list and display them
6. **Portfolio value** — fetch SOL and token prices from an API and display total portfolio value in USD
7. **Pagination** — transaction history with "Load more" (cursor-based using `before` parameter)
8. **Network switcher** — let the user switch between devnet and mainnet using a dropdown in the header

---

## Setup

Start from the Lecture 1 assignment OR from the toolkit starter template:

```bash
# From the course toolkit
cp -r ../../toolkit/starter-template ./assignment-02
cd assignment-02
pnpm install
```

Or from scratch:

```bash
pnpm create next-app@latest assignment-02 --typescript --tailwind --app
cd assignment-02
pnpm add @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
         @solana/wallet-adapter-wallets @solana/wallet-adapter-base \
         @solana/spl-token @tanstack/react-query
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card badge separator skeleton sonner
```

---

## File Structure to Create

```
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── providers/
│   │   ├── solana-provider.tsx
│   │   └── query-provider.tsx
│   ├── portfolio/
│   │   ├── sol-balance-card.tsx
│   │   ├── token-list.tsx
│   │   └── tx-history.tsx
│   └── ui/
│       └── address.tsx           ← reusable Address component with copy
├── hooks/
│   ├── use-sol-balance.ts        ← React Query version
│   ├── use-token-accounts.ts
│   ├── use-tx-history.ts
│   └── use-account-subscription.ts
└── lib/
    └── format.ts                 ← formatAmount, formatRelativeTime, truncateAddress
```

---

## Key Implementation Details

### `lib/format.ts` hints

```ts
// Format a token amount based on its magnitude
export function formatAmount(amount: number, decimals: number): string {
  // handle large, medium, small, and sub-1 amounts differently
}

// Format a Unix timestamp as relative time
export function formatRelativeTime(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  // ...
}
```

---

### Subscription cleanup pattern

```ts
useEffect(() => {
  if (!publicKey) return;
  const subId = connection.onAccountChange(publicKey, (info) => {
    // update state
  });
  return () => {
    connection.removeAccountChangeListener(subId);
  };
}, [publicKey?.toBase58(), connection]);
```

---

## Grading Rubric

| Criterion | Points | Notes |
|-----------|--------|-------|
| Token list renders with correct amounts | 20 | Proper decimal conversion |
| Skeleton loading state (card-shaped) | 10 | No layout shift |
| Empty state with description | 8 | Human copy, not "No results" |
| Error state with retry | 8 | Inline, actionable |
| SOL balance uses subscription | 15 | `onAccountChange`, not polling |
| Transaction history with explorer links | 12 | Correct cluster, new tab |

---

| Criterion | Points | Notes |
|-----------|--------|-------|
| React Query used for all fetches | 10 | No raw `useState` + `useEffect` fetching |
| Manual refresh works | 5 | Calls `refetch()`, disables during load |
| Address component with copy | 7 | With "Copied!" confirmation |
| No TypeScript errors | 5 | `pnpm build` passes |
| **Total** | **100** | |
| Token metadata (stretch) | +15 | Name + logo displayed |
| Portfolio USD value (stretch) | +10 | Price source noted |
| Pagination (stretch) | +10 | Cursor-based, works correctly |
| Network switcher (stretch) | +10 | State persists across refreshes |

---

## Common Pitfalls

- `TOKEN_PROGRAM_ID` needs `@solana/spl-token` installed — don't import from `@solana/web3.js`
- Token amounts from the RPC are already parsed — `uiAmount` is ready to display (don't divide again)
- Subscription IDs must be tracked in a `ref`, not `state` — updating state in a subscription triggers re-renders
- React Query `queryKey` must include the wallet address — see Q10 from the lecture quiz
- `onAccountChange` fires for ANY account change, including rent — don't assume it's always a balance change
