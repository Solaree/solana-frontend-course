---
marp: true
---

# Lecture 1 — Solana Frontend Foundations

**Duration:** ~90 minutes  
**Goal:** Connect a wallet, read a SOL balance, and understand why Solana's programming model is different from what you know.

---

## 1. Why Solana — The Frontend Perspective

Solana processes ~50,000 transactions per second with ~400 ms finality. For a frontend developer, that means:

- **Instant feedback:** Transactions confirm fast enough to update UI optimistically without feeling deceptive
- **Cheap enough to use:** Fees are ~$0.00025 per tx — you can afford micro-interactions
- **Rich data on-chain:** Token balances, NFTs, program state — all readable without a backend API

The catch: Solana's account model is nothing like a Web2 database. Understanding this is the single most important concept in this course.

---

## 2. The Account Model (vs. What You Know)

### Web2 mental model
In a Web2 app, a user's data lives in a database row keyed by a user ID. Your backend reads and writes it. You control the schema.

### Solana's model
**Everything is an account.** Every wallet, every token balance, every program's state — they're all accounts. An account is a fixed-size blob of bytes with:

- `lamports` — how much SOL it holds (1 SOL = 1,000,000,000 lamports)
- `owner` — which program can mutate its data
- `data` — arbitrary bytes interpreted by the owning program
- `executable` — whether the account contains a program

---

```
┌─────────────────────────────────────────────┐
│ Account: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA1yd │
├──────────────┬──────────────────────────────┤
│ lamports     │ 2_500_000_000 (2.5 SOL)      │
│ owner        │ System Program               │
│ data         │ [] (empty for wallets)       │
│ executable   │ false                        │
└──────────────┴──────────────────────────────┘
```

**Key insight:** Your wallet balance isn't stored "in" your wallet. It's stored on an account whose address is your public key, owned by the System Program.

Token balances work the same way — each token you hold lives in a separate **token account** (a different address) owned by the Token Program.

---

## 3. Setting Up Your Development Environment

### Required tools

```bash
# Node.js >= 18
node --version

# pnpm (preferred package manager)
npm install -g pnpm

# Solana CLI (for local validator, airdrop on devnet)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
solana --version

# Set to devnet for development
solana config set --url devnet
```

---

### Wallet browser extension

Install **Phantom** or **Backpack** from their official sites. Create a new wallet — never use a wallet holding real funds for development.

### Airdrop devnet SOL

```bash
# Get your devnet address from Phantom (Settings > Your wallet address)
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

---

## 4. Creating a Next.js Solana Project

```bash
pnpm create next-app@latest my-dapp --typescript --tailwind --app
cd my-dapp

# Solana wallet adapter packages
pnpm add @solana/web3.js \
         @solana/wallet-adapter-react \
         @solana/wallet-adapter-react-ui \
         @solana/wallet-adapter-wallets \
         @solana/wallet-adapter-base

# shadcn UI
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dropdown-menu sonner
```

---

## 5. Understanding `@solana/web3.js` — Core Primitives

### Connection

The `Connection` object is your RPC client. All reads go through it.

```ts
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Public endpoints (rate-limited — use a paid provider in production)
const devnetConn = new Connection(clusterApiUrl("devnet"), "confirmed");
const mainnetConn = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

// With a paid RPC (Helius, QuickNode, Alchemy)
const conn = new Connection("https://mainnet.helius-rpc.com/?api-key=YOUR_KEY", "confirmed");
```

---

The second argument is the **commitment level**:

| Commitment | Meaning | Use when |
|------------|---------|----------|
| `processed` | Seen by one node | Fast reads that don't need finality |
| `confirmed` | Confirmed by supermajority | Default — balance reads, UI updates |
| `finalized` | Irreversible | Payment confirmations |

---

### PublicKey

Every account address is a 32-byte Ed25519 public key, displayed as a base58 string.

```ts
import { PublicKey } from "@solana/web3.js";

const pk = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA1yd6Kfq3PJ4k");

// Derive a program-derived address (PDA) — deterministic sub-addresses
const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("seed"), pk.toBuffer()],
  programId
);
```

---

### Reading a SOL balance

```ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function getSolBalance(conn: Connection, address: string): Promise<number> {
  const pk = new PublicKey(address);
  const lamports = await conn.getBalance(pk);
  return lamports / LAMPORTS_PER_SOL; // convert to SOL
}
```

---

## 6. Wallet Adapter — Wiring Up the Provider

The wallet adapter ecosystem abstracts over Phantom, Backpack, Solflare, and dozens of other wallets. You write one integration; it works with all of them.

---

### The provider hierarchy

```tsx
// src/components/providers/solana-provider.tsx
"use client";

import { useMemo, useEffect } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Import the default wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: React.ReactNode;
}
```

---

```ts
export function SolanaProvider({ children }: Props) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  useEffect(() => {
    // Pre-fetch popular token icons to avoid flickers later.
    // See preloadTokenIcons in src/lib/jupiter.ts (starter template).
    // preloadTokenIcons(SWAP_TOKENS.map((t) => t.mint));
  }, []);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        commitment: "confirmed",
        wsEndpoint: "wss://api.devnet.solana.com",
      }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

---

```tsx
// src/app/layout.tsx
import { SolanaProvider } from "@/components/providers/solana-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaProvider>
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
```

> **Why `useMemo`?** The `wallets` array would be recreated on every render without it, causing the wallet adapter to think the available wallets changed — triggering reconnect loops.

---

## 7. The Two Core Hooks

### `useWallet()`

```tsx
import { useWallet } from "@solana/wallet-adapter-react";
function WalletStatus() {
  const {
    publicKey,      // PublicKey | null — the connected wallet's address
    connected,      // boolean
    connecting,     // boolean — true while the modal is open / handshaking
    disconnecting,  // boolean
    connect,        // () => Promise<void>
    disconnect,     // () => Promise<void>
    signTransaction, // for manual transaction signing
    sendTransaction, // preferred — signs + sends in one call
    wallet,         // the active WalletAdapter instance
  } = useWallet();
  if (connecting) return <p>Connecting...</p>;
  if (!connected) return <button onClick={connect}>Connect Wallet</button>;
  return <p>Connected: {publicKey?.toBase58()}</p>;
}
```

---

### `useConnection()`

```tsx
import { useConnection } from "@solana/wallet-adapter-react";

function MyComponent() {
  const { connection } = useConnection();
  // connection is a fully configured Connection instance
  // pointed at whatever endpoint you set in ConnectionProvider
}
```

---

## 8. Your First Component — Wallet Button

This component implements the pattern from the Solana UI guidelines: three visible states (disconnected, connecting, connected) with address display, copy, and disconnect.

```tsx
// src/components/wallet/wallet-button.tsx
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Copy, ExternalLink, LogOut, CheckCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

---

```tsx
function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function WalletButton() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openExplorer() {
    if (!publicKey) return;
    window.open(
      `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`,
      "_blank",
      "noreferrer"
    );
  }

  if (connecting) {
    return (
      <Button disabled aria-busy="true" className="gap-2">
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden />
        Connecting...
      </Button>
    );
  }

  if (!connected || !publicKey) {
    return (
      <Button onClick={() => setVisible(true)}>
        Connect Wallet
      </Button>
    );
  }
```

---

```tsx
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="gap-2 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 6px 1px rgba(52,211,153,0.5)" }}
            aria-hidden
          />
          {truncateAddress(publicKey.toBase58())}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copyAddress} className="gap-2">
          {copied ? (
            <CheckCheck className="h-4 w-4 text-green-500" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied!" : "Copy address"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openExplorer} className="gap-2">
          <ExternalLink className="h-4 w-4" aria-hidden />
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => disconnect()}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 9. Reading SOL Balance — Your First Hook

```tsx
// src/hooks/use-sol-balance.ts
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useState } from "react";

interface UseSolBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSolBalance(): UseSolBalanceResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function fetchBalance() {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch balance"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBalance();
  }, [publicKey, connection]); // re-fetch when wallet changes

  return { balance, isLoading, error, refetch: fetchBalance };
}
```

### Displaying the balance

```tsx
// src/components/token/sol-balance.tsx
"use client";

import { useSolBalance } from "@/hooks/use-sol-balance";
import { useWallet } from "@solana/wallet-adapter-react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SolBalance() {
  const { connected } = useWallet();
  const { balance, isLoading, error, refetch } = useSolBalance();

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to see your balance
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">SOL Balance</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={refetch}
          disabled={isLoading}
          aria-label="Refresh balance"
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && balance === null ? (
          // Skeleton — matches the layout of the loaded state
          <div className="space-y-2">
            <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm text-destructive font-medium">
                Couldn't load balance
              </p>
              <Button variant="link" className="h-auto p-0 text-xs" onClick={refetch}>
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular-nums text-3xl font-semibold">
              {balance?.toFixed(4) ?? "0.0000"}
            </span>
            <span className="text-sm text-muted-foreground">SOL</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 10. Putting It Together — First dApp Page

```tsx
// src/app/page.tsx
import { WalletButton } from "@/components/wallet/wallet-button";
import { SolBalance } from "@/components/token/sol-balance";

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-4 md:px-6 lg:px-8">
      <header className="flex items-center justify-between py-6 border-b border-border">
        <h1 className="text-lg font-semibold">My Solana dApp</h1>
        <WalletButton />
      </header>
      <section className="mx-auto max-w-lg py-12">
        <SolBalance />
      </section>
    </main>
  );
}
```

---

## 11. Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `new Connection()` inside render | New connection every render, connection pool exhaustion | Move to provider or `useMemo` |
| `new PublicKey(address)` without try/catch | Crashes on invalid input | Wrap in try/catch; validate user input |
| Forgetting `"use client"` | Hydration errors — wallet adapter only works client-side | Every component using wallet hooks needs this directive |
| `autoConnect` omitted | User must reconnect every page refresh | Set `autoConnect` on `WalletProvider` |
| Raw lamports in UI | Displaying 2500000000 instead of 2.5 SOL | Always divide by `LAMPORTS_PER_SOL` |

---

## Key Takeaways

1. Solana accounts are the fundamental unit — wallets, token balances, and program state are all accounts
2. `Connection` is your RPC client; `PublicKey` is any account address
3. The wallet adapter abstracts over all wallet extensions — one integration works everywhere
4. `useWallet()` gives you the address and signing functions; `useConnection()` gives you the RPC client
5. SOL is measured in lamports (1 SOL = 1,000,000,000 lamports) — always convert for display

---

**Next:** [Lecture 2 — Reading Blockchain State & Token Data](../lecture-02-reading-state/README.md)
