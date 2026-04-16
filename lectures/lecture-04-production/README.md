---
marp: true
---

# Lecture 4 — Production-Ready dApps

**Duration:** ~90 minutes  
**Goal:** Ship a dApp that is fast, secure, accessible, and doesn't break when the RPC hiccups.

---

## 1. The Gap Between "Works in Demo" and "Production"

Most hackathon demos work because:
- You're on devnet with no real traffic
- You know exactly what to click
- Your RPC is warm and responsive
- Nothing unexpected happens

Production fails when:
- 1000 users hit your RPC simultaneously
- A user switches wallets mid-session
- The RPC node is overloaded at 2 AM
- A transaction fails with a cryptic program error
- A user on mobile Safari tries to use your app

This lecture closes that gap.

---

## 2. State Management — Zustand for Global Wallet State

React context re-renders the entire tree. For Solana dApps where wallet state changes frequently, use Zustand for state that lives outside the React tree — avoiding cascading re-renders and persisting user preferences across page loads.

### The wallet store

```ts
// src/store/wallet.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicKey } from "@solana/web3.js";

interface WalletStore {
  // Runtime state — synced from wallet adapter, never persisted
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  walletName: string | null;

  // User preferences — persisted to localStorage
  slippageBps: number;

  syncFromAdapter: (state: {
    publicKey: PublicKey | null;
    connected: boolean;
    connecting: boolean;
    walletName: string | null;
  }) => void;

  setSlippageBps: (bps: number) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      publicKey: null,
      connected: false,
      connecting: false,
      walletName: null,
      slippageBps: 50, // 0.5 % default

      syncFromAdapter: (state) => set(state),
      setSlippageBps: (bps) => set({ slippageBps: bps }),
    }),
    {
      name: "wallet-preferences",
      // Only persist user preferences — runtime state is re-derived from
      // the wallet adapter on every mount, so it's never stored.
      partialize: (state) => ({ slippageBps: state.slippageBps }),
    }
  )
);
```

### The sync bridge

The wallet adapter owns the live connection. A small bridge component pushes its state into Zustand — that way any component can read `publicKey` or `connected` from the store without calling `useWallet()` directly, and without the intermediate re-renders that context propagation causes.

```tsx
// src/components/providers/wallet-sync.tsx
"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletStore } from "@/store/wallet";

export function WalletSync() {
  const { publicKey, connected, connecting, wallet } = useWallet();
  const syncFromAdapter = useWalletStore((s) => s.syncFromAdapter);

  useEffect(() => {
    syncFromAdapter({
      publicKey: publicKey ?? null,
      connected,
      connecting,
      walletName: wallet?.adapter.name ?? null,
    });
  }, [publicKey, connected, connecting, wallet, syncFromAdapter]);

  return null;
}
```

Mount it inside `WalletProvider` so it has access to `useWallet()`:

```tsx
// src/components/providers/solana-provider.tsx
<WalletProvider wallets={wallets} autoConnect>
  <WalletModalProvider>
    <WalletSync />
    {children}
  </WalletModalProvider>
</WalletProvider>
```

### Consuming the store

```tsx
// Any component — no need to call useWallet()
import { useWalletStore } from "@/store/wallet";

function MyComponent() {
  const connected = useWalletStore((s) => s.connected);
  const slippageBps = useWalletStore((s) => s.slippageBps);
  const setSlippageBps = useWalletStore((s) => s.setSlippageBps);
  // slippageBps survives a page refresh — persisted in localStorage
}
```

> **Design rule:** The wallet adapter remains the source of truth for the live connection. Zustand is a read cache for components that don't need to trigger wallet actions, plus a persistence layer for user preferences like slippage tolerance.

---

## 3. RPC Layer — Resilience and Caching

### Never expose your RPC key to the browser

```ts
// src/app/api/rpc/route.ts
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_METHODS = new Set(["getBalance", "getAccountInfo", "getLatestBlockhash", "sendTransaction", ...]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { method } = body;

  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 403 });
  }

  const res = await fetch(process.env.RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}
```

```ts
// src/lib/solana.ts
import { clusterApiUrl } from "@solana/web3.js";

export type SolanaCluster = "devnet" | "mainnet-beta" | "testnet";

export const CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_CLUSTER as SolanaCluster) ?? "devnet";

// Client-side: always proxy through /api/rpc so the API key stays server-side.
// Server-side (SSR/RSC): call the RPC directly — no API route available.
export const RPC_ENDPOINT: string =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : clusterApiUrl(CLUSTER);
```

### Fallback RPC chain

```ts
// src/lib/connection.ts
import { Connection } from "@solana/web3.js";

const ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL ?? "",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

let activeIndex = 0;
export let connection = new Connection(ENDPOINTS[0], "confirmed");

export function rotateRpc() {
  activeIndex = (activeIndex + 1) % ENDPOINTS.length;
  connection = new Connection(ENDPOINTS[activeIndex], "confirmed");
  console.warn(`Rotated RPC to: ${ENDPOINTS[activeIndex]}`);
}
```

---

## 4. Error Boundaries — Catch the Unexpected

```tsx
// src/components/ui/error-boundary.tsx
"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Send to Sentry, Datadog, etc.
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message ?? "An unexpected error occurred."}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try again
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

### Wrapping routes

```tsx
// src/app/layout.tsx
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaProvider>
          <QueryProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </QueryProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
```

---

## 5. Optimistic UI Updates

For fast-feeling UX, update the UI immediately and roll back on failure.

```tsx
// src/hooks/use-optimistic-balance.ts
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function useOptimisticTransfer() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  async function transferWithOptimism(
    transfer: () => Promise<void>,
    amountSol: number
  ) {
    const queryKey = ["solBalance", publicKey?.toBase58()];

    // Snapshot current value
    const previousBalance = queryClient.getQueryData<number>(queryKey);

    // Optimistically deduct the amount
    if (previousBalance !== undefined) {
      queryClient.setQueryData(queryKey, previousBalance - amountSol);
    }

    try {
      await transfer();
      // Invalidate to fetch the real value after confirmation
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      // Roll back to the previous value
      queryClient.setQueryData(queryKey, previousBalance);
      throw err;
    }
  }

  return { transferWithOptimism };
}
```

---

## 6. Performance — What Slows Down Solana dApps

### Problem: New `Connection` on every render

```ts
// BAD — creates a new TCP connection and WebSocket on each render
function Component() {
  const connection = new Connection("https://...");
}

// GOOD — use the adapter's hook
function Component() {
  const { connection } = useConnection();
}
```

### Problem: Fetching accounts one at a time

```ts
// BAD — N sequential RPC calls
for (const mint of mints) {
  const metadata = await fetchMetadata(mint); // 1 call per mint
}

// GOOD — batch
const metadatas = await connection.getMultipleAccountsInfo(mints.map(m => new PublicKey(m)));
```

### Problem: Not deduplicating identical queries

React Query deduplicates queries with the same key automatically. But make sure your keys are consistent:

```ts
// BAD — different key every render
queryKey: ["balance", publicKey?.toBase58(), Date.now()]

// GOOD — stable key
queryKey: ["balance", publicKey?.toBase58()]
```

### Problem: WebSocket leaks

Every unmanaged `onAccountChange` subscription holds a WebSocket connection open. Clean up in `useEffect` return:

```ts
useEffect(() => {
  const subId = connection.onAccountChange(pubkey, handler);
  return () => connection.removeAccountChangeListener(subId);
}, [pubkey?.toBase58()]);
```

---

## 7. Security Checklist

### Input validation

```ts
// Always validate user-supplied addresses
function validatePublicKey(input: string): PublicKey {
  try {
    return new PublicKey(input);
  } catch {
    throw new Error(`Invalid address: "${input}"`);
  }
}

// Never pass user input directly to template strings in URLs
// BAD:
const url = `https://explorer.solana.com/tx/${userInput}`;

// GOOD:
const sig = validateSignature(userInput); // sanitize first
const url = `https://explorer.solana.com/tx/${sig}`;
```

### Never auto-sign

```ts
// BAD — auto-signing is a critical security vulnerability
wallet.signAllTransactions(pendingTxs);

// GOOD — every signature is a deliberate user action
```

### Signature verification (server-side gating)

If your app has a backend that requires wallet authentication:

```ts
// Server: verify signature
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

function verifySignature(
  message: string,
  signatureBase58: string,
  publicKeyBase58: string
): boolean {
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = bs58.decode(signatureBase58);
  const publicKeyBytes = new PublicKey(publicKeyBase58).toBytes();
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}
```

### Environment variables — what goes where

| Variable | Prefix | Exposed to? |
|----------|--------|-------------|
| `HELIUS_API_KEY` | none | Server only |
| `NEXT_PUBLIC_RPC_URL` | `NEXT_PUBLIC_` | Browser (keep non-secret) |
| `DATABASE_URL` | none | Server only |
| `NEXT_PUBLIC_PROGRAM_ID` | `NEXT_PUBLIC_` | Browser (fine — it's public) |

---

## 8. Multi-Wallet Handling

When the user disconnects or switches to a different wallet, all React Query cache must be cleared — otherwise the UI leaks the previous wallet's balances and history into the new session.

```tsx
// src/hooks/use-wallet-cache-clear.ts
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function useWalletCacheClear() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentKey = publicKey?.toBase58() ?? null;

    // Only clear when switching from one wallet to another (not on initial connect)
    if (prevKeyRef.current !== null && currentKey !== prevKeyRef.current) {
      queryClient.clear();
    }

    prevKeyRef.current = currentKey;
  }, [publicKey, queryClient]);
}
```

Call it once inside `QueryProvider` so it's always active:

```tsx
// src/components/providers/query-provider.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // ...queryClient setup...
  return (
    <QueryClientProvider client={queryClient}>
      <WalletCacheClear />
      {children}
    </QueryClientProvider>
  );
}

// Thin wrapper so the hook can run inside the provider tree
function WalletCacheClear() {
  useWalletCacheClear();
  return null;
}
```

---

## 9. Accessibility — Solana-Specific Patterns

### Wallet connect button — keyboard and screen reader

```tsx
// The WalletButton component from Lecture 1 already handles most of this.
// Key additions:

<Button
  onClick={() => setVisible(true)}
  aria-label="Connect your Solana wallet"  // explicit for screen readers
>
  Connect Wallet
</Button>

// When connected:
<DropdownMenuTrigger aria-label={`Wallet connected: ${truncateAddress(publicKey)}`}>
```

### Transaction status — live region

```tsx
// Announce tx status changes to screen readers without requiring focus
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"  // visually hidden, but announced
>
  {status === "confirming" && "Transaction confirming..."}
  {status === "confirmed" && "Transaction confirmed."}
  {status === "failed" && "Transaction failed. Please try again."}
</div>
```

### Loading skeletons — aria

```tsx
<div aria-busy="true" aria-label="Loading token balances...">
  {/* skeleton content */}
</div>
```

---

## 10. Deployment Checklist

### Environment variables

```bash
# .env.local (development)
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CLUSTER=devnet

# Vercel production env (never commit this)
HELIUS_API_KEY=your-secret-key
NEXT_PUBLIC_RPC_URL=/api/rpc    ← proxied route
NEXT_PUBLIC_CLUSTER=mainnet-beta
```

### Pre-deploy verification

```bash
# Type check
pnpm tsc --noEmit

# Build
pnpm build

# Check for exposed secrets
grep -r "api-key\|apikey\|secret\|password" .env* --include="*.ts" --include="*.tsx"
```

### Network indicator — never forget which cluster

```tsx
// src/components/ui/cluster-badge.tsx
import { Badge } from "@/components/ui/badge";

export function ClusterBadge() {
  const cluster = process.env.NEXT_PUBLIC_CLUSTER ?? "devnet";
  if (cluster === "mainnet-beta") return null; // mainnet is the default assumption

  return (
    <Badge
      variant="outline"
      className="font-mono text-xs border-yellow-500/50 text-yellow-600 bg-yellow-500/10"
    >
      {cluster}
    </Badge>
  );
}
```

### Vercel deployment

```bash
# Install Vercel CLI
pnpm add -D vercel

# First deploy
vercel

# Set env vars
vercel env add HELIUS_API_KEY production
vercel env add NEXT_PUBLIC_CLUSTER production

# Production deploy
vercel --prod
```

---

## 11. Testing Strategy

### Unit tests for pure functions

```ts
// src/lib/__tests__/format.test.ts
import { truncateAddress, formatTokenAmount } from "@/lib/format";

test("truncateAddress returns First4...Last4", () => {
  expect(truncateAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA1yd")).toBe("7xKX...A1yd");
});

test("formatTokenAmount handles large amounts", () => {
  expect(formatTokenAmount(1_500_000, 6)).toBe("1.50M");
});
```

### Integration tests — avoid mocking the RPC

```ts
// Real RPC calls in tests (use devnet, not mocks)
// Mock RPC diverges from prod — the lecture 2 assignment note applies here too
const connection = new Connection("https://api.devnet.solana.com");
const balance = await connection.getBalance(new PublicKey(TEST_WALLET));
expect(balance).toBeGreaterThanOrEqual(0);
```

### Component tests

```tsx
// Use @testing-library/react
import { render, screen } from "@testing-library/react";
import { SolBalance } from "@/components/token/sol-balance";

test("shows 'Connect your wallet' when disconnected", () => {
  // Mock useWallet to return disconnected state
  render(<SolBalance />);
  expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
});
```

---

## Key Takeaways

1. Keep private API keys server-side — proxy RPC calls through a Next.js API route
2. Wrap routes in `ErrorBoundary` — one component crash shouldn't take down the page
3. Clear React Query cache on wallet change — stale data from the previous wallet is worse than no data
4. Validate all user-supplied addresses and amounts before touching the RPC
5. WebSocket subscriptions must be cleaned up — every unmanaged sub is a memory/connection leak
6. Show the current cluster prominently — a devnet badge prevents real-money mistakes
7. Ship a network indicator, loading state, error state, and empty state for every data-fetching component before calling a feature complete

---

**You've completed the course.** Build something and ship it to Colosseum.
