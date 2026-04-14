# Lecture 2 — Reading Blockchain State & Token Data

**Duration:** ~90 minutes  
**Goal:** Fetch token balances, NFTs, and live account data using proper RPC patterns.

---

## 1. RPC Deep Dive — What You Can Read

The Solana RPC API exposes everything on-chain. Key methods:

| Method | What It Returns |
|--------|----------------|
| `getBalance` | SOL balance in lamports |
| `getAccountInfo` | Raw account data (bytes + metadata) |
| `getParsedAccountInfo` | Decoded account data (program-specific) |
| `getTokenAccountsByOwner` | All token accounts for a wallet |
| `getSignaturesForAddress` | Recent transaction signatures |
| `getTransaction` | Full transaction details |
| `getProgramAccounts` | All accounts owned by a program |

### Choosing an RPC provider

Public endpoints (`api.devnet.solana.com`) are rate-limited and unreliable for production. Use a provider:

| Provider | Free tier | Best for |
|----------|-----------|---------|
| **Helius** | 100K credits/day | NFTs, DAS API, webhooks |
| **QuickNode** | 10M credits/month | High-throughput, multi-chain |
| **Alchemy** | 300M compute units/month | Familiar if coming from EVM |
| **Triton** | Pay-as-you-go | Low-latency, bare-metal |

```ts
// .env.local
NEXT_PUBLIC_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_KEY

// src/lib/solana.ts
import { Connection } from "@solana/web3.js";

export const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);
```

> **Security note:** `NEXT_PUBLIC_` variables are exposed to the browser. For private API keys, proxy through a Next.js API route.

---

## 2. Token Accounts — How SPL Tokens Work

Every SPL token you hold has its own **token account** — a separate on-chain account that stores:
- Which mint (token) it represents
- How many tokens it holds (as a raw integer)
- The owner (your wallet)

```
Your Wallet (7xKX...)
    │
    ├── SOL balance on System Program account
    ├── Token Account for USDC (different address)
    ├── Token Account for BONK (different address)
    └── Token Account for JUP  (different address)
```

The **associated token account (ATA)** is the canonical token account derived from `(owner, mint)`. It always exists at the same deterministic address, so programs can find your token balance without you telling them where it is.

### Fetching all token accounts

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  address: string;
}

async function getTokenBalances(
  connection: Connection,
  owner: PublicKey
): Promise<TokenBalance[]> {
  const response = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return response.value
    .map(({ pubkey, account }) => {
      const info = account.data.parsed.info;
      return {
        mint: info.mint,
        amount: Number(info.tokenAmount.amount),
        decimals: info.tokenAmount.decimals,
        uiAmount: info.tokenAmount.uiAmount ?? 0,
        address: pubkey.toBase58(),
      };
    })
    .filter((t) => t.uiAmount > 0); // hide zero-balance dust accounts
}
```

---

## 3. Token Metadata — Names and Logos

Raw token accounts only give you the mint address — not the name, symbol, or logo. For that you need metadata.

### Option A — Helius DAS API (recommended)

Helius's Digital Asset Standard (DAS) API returns rich metadata in a single call:

```ts
async function getTokensWithMetadata(owner: string) {
  const response = await fetch(process.env.NEXT_PUBLIC_RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "get-assets",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 100,
        displayOptions: { showFungible: true, showNativeBalance: true },
      },
    }),
  });
  const { result } = await response.json();
  return result.items; // includes name, symbol, image, balance
}
```

### Option B — Jupiter Token List (simple, no API key)

```ts
// Cache this — it's a big list
const TOKEN_LIST_URL = "https://token.jup.ag/strict";

interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
}

let tokenListCache: Map<string, JupiterToken> | null = null;

async function getTokenList(): Promise<Map<string, JupiterToken>> {
  if (tokenListCache) return tokenListCache;
  const res = await fetch(TOKEN_LIST_URL);
  const tokens: JupiterToken[] = await res.json();
  tokenListCache = new Map(tokens.map((t) => [t.address, t]));
  return tokenListCache;
}

async function enrichToken(mint: string) {
  const list = await getTokenList();
  return list.get(mint) ?? { name: "Unknown", symbol: mint.slice(0, 4), logoURI: "" };
}
```

---

## 4. Real-Time Subscriptions

### WebSocket subscriptions vs polling

| Method | Latency | Cost | Best for |
|--------|---------|------|---------|
| `onAccountChange` | ~400 ms | Low (1 sub per account) | Single account monitoring |
| `onProgramAccountChange` | ~400 ms | Medium | Watching a program's state |
| Polling (`setInterval`) | ≥ poll interval | RPC calls | Simple balance refresh |

### Subscribing to account changes

```tsx
// src/hooks/use-account-subscription.ts
import { useConnection } from "@solana/wallet-adapter-react";
import { AccountInfo, Context, PublicKey } from "@solana/web3.js";
import { useEffect, useRef } from "react";

export function useAccountSubscription(
  publicKey: PublicKey | null,
  onUpdate: (info: AccountInfo<Buffer>, context: Context) => void
) {
  const { connection } = useConnection();
  const subIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    // Subscribe
    subIdRef.current = connection.onAccountChange(
      publicKey,
      onUpdate,
      "confirmed"
    );

    // Cleanup — always unsubscribe when component unmounts or key changes
    return () => {
      if (subIdRef.current !== null) {
        connection.removeAccountChangeListener(subIdRef.current);
        subIdRef.current = null;
      }
    };
  }, [publicKey?.toBase58(), connection]);
}
```

### Live SOL balance hook with React Query & Subscription

```tsx
// src/hooks/use-sol-balance.ts
"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccountSubscription } from "./use-account-subscription";

export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const queryKey = ["solBalance", publicKey?.toBase58()];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!publicKey) throw new Error("No wallet connected");
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!publicKey,
    staleTime: 30_000,
    refetchInterval: 60_000, // polling fallback
  });

  // Live update via WebSocket — fires when balance changes on-chain
  useAccountSubscription(publicKey, (info) => {
    const sol = info.lamports / LAMPORTS_PER_SOL;
    queryClient.setQueryData(queryKey, sol);
  });

  return query;
}
```

---

## 5. Token Prices & USD Value

Reading raw token amounts is fine, but users want to see USD. The starter template includes a `/api/prices` proxy that uses the Jupiter Price API.

### Fetching prices via proxy

```tsx
// src/hooks/use-token-prices.ts
export function useTokenPrices(mints: string[] = []) {
  const allMints = Array.from(new Set(["So11111111111111111111111111111111111111112", ...mints]));
  const key = allMints.sort().join(",");

  return useQuery({
    queryKey: ["tokenPrices", key],
    queryFn: async () => {
      const res = await fetch(`/api/prices?ids=${allMints.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch prices");
      return res.json(); // returns { [mint]: usdPrice }
    },
    staleTime: 60_000,
  });
}
```

Managing loading/error/refetch state manually with `useState` doesn't scale. Use `@tanstack/react-query`:

```bash
pnpm add @tanstack/react-query
```

### Setup

```tsx
// src/components/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,      // data is fresh for 30 s
            gcTime: 5 * 60_000,     // keep in cache for 5 min
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### SOL balance with React Query

```tsx
// src/hooks/use-sol-balance-query.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";

export function useSolBalanceQuery() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["solBalance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) throw new Error("No wallet connected");
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!publicKey,
    refetchInterval: 30_000, // poll every 30 s as a fallback
  });
}
```

### Token accounts with React Query

```tsx
// src/hooks/use-token-accounts.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";

export function useTokenAccounts() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["tokenAccounts", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return [];
      const { value } = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      return value
        .map(({ pubkey, account }) => {
          const info = account.data.parsed.info;
          return {
            mint: info.mint as string,
            address: pubkey.toBase58(),
            decimals: info.tokenAmount.decimals as number,
            uiAmount: (info.tokenAmount.uiAmount ?? 0) as number,
            rawAmount: BigInt(info.tokenAmount.amount),
          };
        })
        .filter((t) => t.uiAmount > 0)
        .sort((a, b) => b.uiAmount - a.uiAmount);
    },
    enabled: !!publicKey,
  });
}
```

---

## 6. Displaying Token Lists — The Full Component

```tsx
// src/components/token/token-list.tsx
"use client";

import { useTokenAccounts } from "@/hooks/use-token-accounts";
import { useWallet } from "@solana/wallet-adapter-react";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTokenAmount } from "@/lib/format";

export function TokenList() {
  const { connected } = useWallet();
  const { data: tokens, isLoading } = useTokenAccounts();

  if (!connected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Tokens</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground animate-pulse">
            Loading tokens...
          </p>
        ) : tokens?.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No tokens found
          </p>
        ) : (
          tokens?.map((token) => (
            <div key={token.address} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium font-mono">{token.mint.slice(0, 4)}...</p>
                  <p className="text-xs text-muted-foreground">{token.decimals} decimals</p>
                </div>
              </div>
              <span className="font-mono text-sm font-medium">
                {formatTokenAmount(token.uiAmount)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 7. Transaction History

```tsx
// src/hooks/use-transaction-history.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { ConfirmedSignatureInfo } from "@solana/web3.js";

export function useTransactionHistory(limit = 10) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["txHistory", publicKey?.toBase58(), limit],
    queryFn: async (): Promise<ConfirmedSignatureInfo[]> => {
      if (!publicKey) return [];
      return connection.getSignaturesForAddress(publicKey, { limit });
    },
    enabled: !!publicKey,
    staleTime: 60_000, // tx history doesn't change often
  });
}
```

---

## 8. RPC Performance Patterns

### Batching requests

```ts
// Instead of 3 sequential calls, use getMultipleAccountsInfo
const accounts = await connection.getMultipleAccountsInfo([
  walletPubkey,
  tokenAccountPubkey,
  anotherAccountPubkey,
]);
// Returns 3 results in 1 RPC round trip
```

### Avoiding `getProgramAccounts` in production

`getProgramAccounts` can return thousands of results and is often disabled or rate-limited on public RPCs. Alternatives:

- **Helius searchAssets / getAssetsByOwner** — DAS API, indexed and paginated
- **Account indexers** — Dialect, Squads, etc.
- **Your own indexer** — use a webhook (Helius) to stream changes into a database

---

## Key Takeaways

1. Every SPL token balance lives in a separate **token account** at a deterministic (ATA) address
2. `getParsedTokenAccountsByOwner` is the fastest way to get all token balances for a wallet
3. Use `onAccountChange` for real-time updates — unsubscribe in cleanup to avoid memory leaks
4. React Query handles caching, deduplication, and background refetching — use it instead of manual `useState`
5. Avoid `getProgramAccounts` on production; use Helius DAS API or an indexer

---

**Next:** [Lecture 3 — Building & Sending Transactions](../lecture-03-transactions/README.md)
