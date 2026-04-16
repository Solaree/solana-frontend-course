---
marp: true
---

# Lecture 3 — Building & Sending Transactions

**Duration:** ~90 minutes  
**Goal:** Build, sign, and send transactions — from a simple SOL transfer to calling on-chain programs with priority fees.

---

## 1. Transaction Anatomy

A Solana transaction is a signed bundle of **instructions**. Each instruction targets one program and tells it what to do.

```
Transaction
├── signatures[]           ← Ed25519 signatures, one per signer
├── message
│   ├── header             ← how many signers, readonly accounts, etc.
│   ├── accountKeys[]      ← all accounts referenced (deduplicated)
│   ├── recentBlockhash    ← the "expiry timer" — valid for ~60-90 seconds
│   └── instructions[]
│       ├── programIdIndex ← index into accountKeys
│       ├── accounts[]     ← indexes into accountKeys
│       └── data           ← serialized instruction data
```

### Key concepts

| Concept | What it means |
|---------|--------------|
| `recentBlockhash` | The transaction expires if not confirmed before ~150 blocks (~60-90 s). Always fetch fresh. |
| Instruction | A single operation — "transfer X lamports from A to B", "mint token", "swap via Jupiter" |
| Signer | Any account that must authorize the transaction — typically your wallet |
| Fee payer | The account that pays the base fee (usually the signer) |

---

## 2. Legacy vs Versioned Transactions

Solana has two transaction formats:

| Feature | Legacy | Versioned (v0) |
|---------|--------|---------------|
| Max accounts | 35 | ~64 (with address lookup tables) |
| Address Lookup Tables | No | Yes — compress large account lists |
| Support | Universal | Requires newer wallet versions |
| When to use | Simple transfers, most dApps | Jupiter swaps, complex DeFi |

For most hackathon projects, **use legacy transactions** unless you're integrating Jupiter or a protocol that requires v0.

---

## 3. Building a SOL Transfer

```tsx
// src/lib/transactions.ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export async function buildSolTransferTx(
  connection: Connection,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountSol: number
): Promise<Transaction> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  });

  tx.add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    })
  );

  return tx;
}
```

### Sending with the wallet adapter

The wallet adapter's `sendTransaction` method handles signing + submission in one step:

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildSolTransferTx } from "@/lib/transactions";
import { toast } from "sonner";

function useSolTransfer() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  async function transfer(toAddress: string, amountSol: number) {
    if (!publicKey) throw new Error("Wallet not connected");

    const toPubkey = new PublicKey(toAddress);
    const tx = await buildSolTransferTx(connection, publicKey, toPubkey, amountSol);

    const signature = await sendTransaction(tx, connection);

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    return signature;
  }

  return { transfer };
}
```

---

## 4. Priority Fees & Compute Units

Solana transactions compete for inclusion in blocks. **Priority fees** (measured in micro-lamports per compute unit) let you jump the queue during high-demand periods.

### Always set compute unit limits

```ts
import {
  ComputeBudgetProgram,
  Transaction,
} from "@solana/web3.js";

function addPriorityFee(tx: Transaction, options?: {
  microLamportsPerCU?: number;  // default: 5000 (~median)
  computeUnits?: number;        // default: 200_000
}): Transaction {
  const { microLamportsPerCU = 5_000, computeUnits = 200_000 } = options ?? {};

  // IMPORTANT: prepend these — they must come before other instructions
  tx.instructions.unshift(
    // Tell the runtime how many CUs this tx will use (avoids over-reservation)
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    // Set the priority fee per CU
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCU }),
  );

  return tx;
}
```

### Estimating priority fees dynamically

```ts
// Get current fee estimates from the network
async function getRecommendedPriorityFee(connection: Connection): Promise<number> {
  // Use Helius priority fee API if available
  try {
    const response = await fetch(connection.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "priority-fee",
        method: "getPriorityFeeEstimate",
        params: [{ options: { priorityLevel: "Medium" } }],
      }),
    });
    const { result } = await response.json();
    return result?.priorityFeeEstimate ?? 5_000;
  } catch {
    return 5_000; // fallback to a conservative default
  }
}
```

---

## 5. Transaction Status — The Full Lifecycle

A transaction goes through several states after submission:

```
buildTx() → signTx() → sendRawTx() → confirmTx()
     │            │           │              │
  Building     Wallet     Submitted      Confirmed
               popup      (pending)
```

### Robust confirmation with retry

```ts
// src/lib/confirm-transaction.ts
import { Connection, TransactionSignature } from "@solana/web3.js";

export async function confirmTransactionWithRetry(
  connection: Connection,
  signature: TransactionSignature,
  maxRetries = 3
): Promise<"confirmed" | "failed"> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      if (result.value.err) {
        // Transaction landed but had an error
        return "failed";
      }
      return "confirmed";
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Retry with exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  return "failed";
}
```

---

## 6. Transaction Simulation — Show Results Before Signing

Never send a transaction the user hasn't seen the result of.

```ts
import { Connection, Transaction, PublicKey } from "@solana/web3.js";

interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: string;
}

export async function simulateTransaction(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
): Promise<SimulationResult> {
  // Simulation doesn't require a real signature
  tx.feePayer = feePayer;

  // Use a recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const result = await connection.simulateTransaction(tx, undefined, true);

  if (result.value.err) {
    return {
      success: false,
      logs: result.value.logs ?? [],
      unitsConsumed: result.value.unitsConsumed ?? 0,
      error: JSON.stringify(result.value.err),
    };
  }

  return {
    success: true,
    logs: result.value.logs ?? [],
    unitsConsumed: result.value.unitsConsumed ?? 0,
  };
}
```

---

## 7. The Full Send Flow — Hook + UI

### The hook

```tsx
// src/hooks/use-send-transaction.ts
"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { decodeTransactionError, explorerTxUrl } from "@/lib/format";

export function useSendTransaction() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("idle");

  async function send(tx: Transaction) {
    if (!publicKey) return null;

    try {
      setStatus("awaiting-approval");
      const sig = await sendTransaction(tx, connection);

      setStatus("confirming");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setStatus("confirmed");
      toast.success("Transaction confirmed");

      // Invalidate caches to refresh balances
      queryClient.invalidateQueries({ queryKey: ["solBalance", publicKey.toBase58()] });
      return sig;
    } catch (err) {
      const message = decodeTransactionError(err);
      if (message) {
        setStatus("failed");
        toast.error(message);
      } else {
        setStatus("idle"); // User cancelled
      }
      return null;
    }
  }

  return { send, status, isLoading: status === "awaiting-approval" || status === "confirming" };
}
```

### The UI

```tsx
// src/components/transactions/send-sol-form.tsx
"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { buildSolTransferTx } from "@/lib/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";

const schema = z.object({
  recipient: z.string().refine((val) => {
    try { new PublicKey(val); return true; } catch { return false; }
  }, "Invalid Solana address"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(100, "Max 100 SOL"),
});

type FormValues = z.infer<typeof schema>;

export function SendSolForm() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { send, status } = useSendTransaction();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const statusLabel: Record<typeof status, string> = {
    idle: "Send SOL",
    building: "Building...",
    "awaiting-approval": "Approve in wallet...",
    submitting: "Submitting...",
    confirming: "Confirming...",
    confirmed: "Sent!",
    failed: "Try again",
  };

  async function onSubmit(values: FormValues) {
    if (!publicKey) return;
    const toPubkey = new PublicKey(values.recipient);
    const tx = await buildSolTransferTx(connection, publicKey, toPubkey, values.amount);
    const sig = await send(tx);
    if (sig) reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Send SOL</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="recipient">Recipient address</Label>
            <Input
              id="recipient"
              type="text"
              autoComplete="off"
              placeholder="Enter Solana address"
              aria-invalid={!!errors.recipient}
              aria-describedby={errors.recipient ? "recipient-error" : undefined}
              {...register("recipient")}
            />
            {errors.recipient && (
              <p id="recipient-error" className="text-xs text-destructive" role="alert">
                {errors.recipient.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (SOL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.0001"
              min="0"
              max="100"
              autoComplete="off"
              placeholder="0.00"
              aria-invalid={!!errors.amount}
              aria-describedby={errors.amount ? "amount-error" : undefined}
              {...register("amount")}
            />
            {errors.amount && (
              <p id="amount-error" className="text-xs text-destructive" role="alert">
                {errors.amount.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={status !== "idle" && status !== "failed" && status !== "confirmed"}
          >
            {status === "confirming" || status === "submitting" || status === "awaiting-approval" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {statusLabel[status]}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

---

## 8. Calling On-Chain Programs — Anchor

Most Solana programs are built with Anchor, which generates a typed client from an IDL (Interface Definition Language) file.

```bash
pnpm add @coral-xyz/anchor
```

```tsx
// src/lib/anchor.ts
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import myProgramIdl from "./my_program.json"; // generated IDL

export function getAnchorProvider(
  connection: Connection,
  wallet: WalletContextState
): AnchorProvider {
  return new AnchorProvider(
    connection,
    // Adapt wallet-adapter to Anchor's wallet interface
    {
      publicKey: wallet.publicKey!,
      signTransaction: wallet.signTransaction!,
      signAllTransactions: wallet.signAllTransactions!,
    },
    { commitment: "confirmed" }
  );
}

export function getProgram(provider: AnchorProvider) {
  return new Program(
    myProgramIdl as Idl,
    new PublicKey(myProgramIdl.metadata.address),
    provider
  );
}
```

### Calling a program instruction

```tsx
function useMyProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  async function callInstruction(data: string) {
    if (!wallet.publicKey) throw new Error("Not connected");

    const provider = getAnchorProvider(connection, wallet);
    const program = getProgram(provider);

    // Anchor builds and sends the transaction for you
    const signature = await program.methods
      .myInstruction(data)
      .accounts({
        user: wallet.publicKey,
        // ... other required accounts
      })
      .rpc();

    return signature;
  }

  return { callInstruction };
}
```

---

## 9. Decoding Transaction Errors

Common errors and how to handle them in the UI:

| Error | Cause | User message |
|-------|-------|-------------|
| `WalletSignTransactionError` | User rejected | Treat as cancel, not error |
| `blockhash not found` | Took too long to sign | "Please try again" |
| `insufficient funds` | Not enough SOL for fee | "You need more SOL to cover the transaction fee" |
| `Transaction simulation failed` | Program rejected | Decode from logs |
| `0x1` (custom program error) | Check IDL error codes | Map to human message |

```ts
function decodeTransactionError(err: unknown): string {
  if (!(err instanceof Error)) return "An unknown error occurred";

  // User cancelled
  if (err.name === "WalletSignTransactionError") return "";

  // Blockhash expired
  if (err.message.includes("Blockhash not found")) {
    return "The transaction took too long. Please try again.";
  }

  // Insufficient SOL
  if (err.message.includes("insufficient funds")) {
    return "You don't have enough SOL to cover this transaction.";
  }

  // Slippage exceeded (Jupiter / DEX)
  if (err.message.includes("SlippageToleranceExceeded")) {
    return "Price moved too much. Try raising your slippage tolerance.";
  }

  return err.message;
}
```

---

## 10. Jupiter Swap Integration (Bonus)

Jupiter is the leading DEX aggregator on Solana. Their SDK handles routing, versioned transactions, and slippage.

The starter template's `/api/swap` and `/api/swap/quote` routes proxy Jupiter server-side — no SDK needed in the browser.

### Fetching a Quote (via Proxy)

```tsx
async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50
) {
  const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  const res = await fetch(`/api/swap/quote?${params}`);
  if (!res.ok) throw new Error("No routes found for this pair");
  return res.json(); // JupiterQuote
}
```

### Building the Transaction (via Proxy)

```tsx
async function buildSwapTx(quote: JupiterQuote, userPublicKey: string) {
  const res = await fetch("/api/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey }),
  });
  const { swapTransaction } = await res.json();
  return swapTransaction; // base64-encoded VersionedTransaction
}
```

### Deserializing and sending

Jupiter returns a **versioned transaction** — you must use `VersionedTransaction`, not `Transaction`:

```tsx
import { VersionedTransaction } from "@solana/web3.js";

const bytes = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
const tx = VersionedTransaction.deserialize(bytes);
const signed = await signTransaction(tx); // from useWallet()
const sig = await connection.sendRawTransaction(signed.serialize());
```

---

## Key Takeaways

1. A transaction is a bundle of instructions — each instruction targets one program
2. Always fetch a fresh `blockhash` before building a transaction — it expires in ~60-90 seconds
3. `sendTransaction` from the wallet adapter handles signing + submission — prefer it over manual signing
4. Set compute unit limit and price on every transaction (even simple ones) — it keeps fees predictable
5. Simulate before sending — show users what will happen; catch errors before they reach the blockchain
6. Never show an error toast for user wallet rejections — that's a cancellation, not an error
7. `WalletSignTransactionError` is the rejection signal — check for it before displaying errors

---

**Next:** [Lecture 4 — Production-Ready dApps](../lecture-04-production/README.md)
