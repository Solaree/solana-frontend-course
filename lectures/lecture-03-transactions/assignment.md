---
marp: true
---

# Assignment 3 — Token Transfer dApp

**Estimated time:** 90–120 minutes  
**Difficulty:** Intermediate–Advanced  

---

## Objective

Build a complete token transfer interface that lets users send SOL and SPL tokens to any address. The flow must include transaction simulation, clear status feedback, and proper error handling.

---

## Requirements

1. **Send SOL form** with:
   - Validated recipient address (must be a valid base58 public key)
   - Amount input with max button (sets amount to current balance minus fee buffer)
   - Form-level error display (react-hook-form + zod)
   - Submit disabled until wallet is connected

2. **Transaction status flow** — user sees each stage:
   - "Approve in wallet..." while waiting for signature
   - "Confirming..." while waiting for the block
   - "Confirmed" with an explorer link (new tab, correct cluster)
   - Error message for failed transactions (human-readable, not raw error codes)

---

3. **User rejection handling** — if the user rejects in their wallet, return to idle state without showing an error

4. **Priority fee toggle** — "Fast" / "Normal" radio or toggle that adds/removes a compute unit price instruction

5. **Transaction simulation button** — "Preview" button that calls `simulateTransaction` and shows:
   - Whether the simulation succeeded
   - Estimated compute units
   - "Transaction looks good — proceed?" confirmation

---

### Stretch goals

6. **Send SPL tokens** — extend the form to support selecting a token from the wallet's holdings and sending via the Token Program's `transfer` instruction
7. **Batched transactions** — send SOL to multiple recipients in a single transaction (add/remove recipient rows)
8. **Anchor program call** — deploy the `hello_world` example program to devnet and add a "Ping program" button that increments a counter stored in a PDA
9. **Jupiter swap** — integrate the Jupiter quote API to show a swap preview (input token → output token, estimated output, price impact)

---

## Setup

```bash
pnpm create next-app@latest assignment-03 --typescript --tailwind --app
cd assignment-03
pnpm add @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
         @solana/wallet-adapter-wallets @solana/wallet-adapter-base \
         @solana/spl-token @tanstack/react-query \
         react-hook-form @hookform/resolvers zod
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label form badge separator radio-group sonner
```

---

## Key Implementation Hints

### Validate a Solana address in zod

```ts
const addressSchema = z.string().refine((val) => {
  try { new PublicKey(val); return true; } catch { return false; }
}, { message: "Invalid Solana address" });
```

### Compute unit estimation via simulation

```ts
const sim = await connection.simulateTransaction(tx);
const estimatedCU = sim.value.unitsConsumed ?? 0;
// Pad by 10% to avoid out-of-budget errors
const safeLimit = Math.ceil(estimatedCU * 1.1);
```

---

### SPL token transfer instruction

```ts
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

// Get or create the recipient's ATA
const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
const recipientATAInfo = await connection.getAccountInfo(recipientATA);

const tx = new Transaction();

// Create ATA if it doesn't exist (adds rent cost to the sender)
if (!recipientATAInfo) {
  tx.add(createAssociatedTokenAccountInstruction(
    senderPubkey,  // payer
    recipientATA,
    recipientPubkey,
    mintPubkey,
  ));
}

tx.add(createTransferInstruction(
  senderATA,          // source
  recipientATA,       // destination
  senderPubkey,       // owner
  BigInt(rawAmount),  // amount in raw units (not UI amount)
));
```

---

## Grading Rubric

| Criterion | Points | Notes |
|-----------|--------|-------|
| Address validation (zod) | 10 | Error message on invalid input |
| Amount validation | 10 | Positive, ≤ balance |
| "Approve in wallet" stage visible | 10 | Distinct from "Confirming" |
| Explorer link after confirm | 10 | New tab, correct cluster |
| User rejection → silent idle | 15 | No error toast, no console warning |
| Priority fee toggle works | 10 | Adds/removes ComputeBudget instruction |
| Simulate button works | 15 | Shows CU estimate, success/fail |

---

| Criterion | Points | Notes |
|-----------|--------|-------|
| No TypeScript errors | 10 | `pnpm build` passes |
| Accessibility: labels on all inputs | 5 | `<label>` + `aria-describedby` for errors |
| `pnpm build` produces no type errors | 5 | |
| **Total** | **100** | |
| SPL token send (stretch) | +20 | Handles missing ATA creation |
| Batch send (stretch) | +15 | Multiple recipients in one tx |
| Anchor ping (stretch) | +15 | Working devnet program call |
| Jupiter quote (stretch) | +15 | Shows estimated output |

---

## Common Pitfalls

- SPL token amounts are in **raw units** (multiply by `10 ** decimals`) — don't pass UI amounts to `createTransferInstruction`
- The recipient's ATA might not exist — always check and create it if missing (this adds to transaction cost)
- `sendTransaction` returns immediately after the user signs — you still need to call `confirmTransaction`
- If a simulation fails, the error is in `result.value.err` and the logs are in `result.value.logs` — parse them, don't show raw JSON
- Priority fee instructions **must be first** in the instruction list — add them with `unshift` or use `tx.instructions.unshift(...)`
