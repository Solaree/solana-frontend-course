---
marp: true
---

# Lecture 3 Quiz — Building & Sending Transactions

10 questions. Recommended time: 15 minutes.

---

## Questions

**Q1.** What happens if a transaction's `recentBlockhash` is too old when you try to submit it?

- A) The transaction gets queued and submitted when a valid blockhash is available
- B) The transaction is rejected with "blockhash not found"
- C) The fee is charged but the instructions are not executed
- D) The transaction is automatically re-signed with a fresh blockhash

---

**Q2.** Which `ComputeBudgetProgram` instruction should you include to set a priority fee?

- A) `setTransactionFee`
- B) `setPriorityLevel`
- C) `setComputeUnitPrice`
- D) `setBudgetLimit`

---

**Q3.** A user clicks "Reject" in their wallet popup when you call `sendTransaction`. How should your app respond?

- A) Show an error toast: "Transaction failed"
- B) Show a red error state and ask the user to retry
- C) Catch `WalletSignTransactionError`, treat it as a cancellation, return to idle state silently
- D) Throw a `UserCancelledError` and log it to the server

---

**Q4.** Why is `simulateTransaction` important before sending?

- A) It's required by the Solana runtime before any transaction can be submitted
- B) It lets you show the user what will happen — expected outcomes, compute cost — without spending fees
- C) It locks the blockhash so the transaction can't expire
- D) It reduces the transaction fee by pre-validating accounts

---

**Q5.** What is the main advantage of versioned transactions (v0) over legacy transactions?

- A) They're signed faster because they use a lighter signature scheme
- B) They support Address Lookup Tables, enabling more accounts per transaction
- C) They have a longer blockhash expiry window
- D) They don't require a fee payer

---

**Q6.** You want to call a function on an Anchor program. Which package provides the `Program` and `AnchorProvider` classes?

- A) `@solana/web3.js`
- B) `@solana/spl-token`
- C) `@coral-xyz/anchor`
- D) `@project-serum/anchor` (deprecated)

---

**Q7.** What does `setComputeUnitLimit({ units: 200_000 })` tell the runtime?

- A) The transaction budget is 200,000 micro-lamports
- B) The transaction will use at most 200,000 compute units — saving unused capacity for other transactions
- C) The priority fee is 200,000 lamports
- D) The transaction expires after 200,000 slots

---

**Q8.** You build a transaction and call `sendTransaction(tx, connection)`. The wallet adapter throws `"insufficient funds for rent"`. What does this mean?

- A) The recipient account doesn't have enough SOL to exist on-chain
- B) The fee payer doesn't have enough SOL to pay the base transaction fee
- C) The sender's token account will drop below the rent-exempt minimum after the transfer
- D) B or C — accounts need a minimum SOL balance to exist (rent exemption), and a transfer that would drain below it is rejected

---

**Q9.** You call `connection.confirmTransaction(...)`. It resolves with `result.value.err !== null`. What does this mean?

- A) The transaction was never submitted
- B) The transaction landed on-chain but the instructions failed (program error)
- C) The network rejected the transaction before landing
- D) The blockhash expired during confirmation

---

**Q10.** When integrating Jupiter swaps, which transaction format do you typically receive from `swapPost`?

- A) A `Transaction` object (legacy)
- B) A `VersionedTransaction` serialized as a base64 string
- C) A list of instructions to compose into your own transaction
- D) A raw byte array in little-endian encoding

---

## Answer Key

| Q | Answer | Explanation |
|---|--------|-------------|
| 1 | **B** | Blockhashes expire after ~150 blocks (~60-90 s). A stale blockhash causes `BlockhashNotFound`. |
| 2 | **C** | `ComputeBudgetProgram.setComputeUnitPrice({ microLamports })` sets the priority fee per compute unit. |
| 3 | **C** | User rejection is not an error — catch `WalletSignTransactionError` and return to idle state. Never show an error toast. |
| 4 | **B** | Simulation is a dry run — shows logs, expected outcome, and CU cost without committing to the chain. |
| 5 | **B** | Address Lookup Tables allow v0 transactions to reference more accounts by storing common addresses in a compressed form. |

---

| Q | Answer | Explanation |
|---|--------|-------------|
| 6 | **C** | `@coral-xyz/anchor` is the current, maintained Anchor client. |
| 7 | **B** | `setComputeUnitLimit` caps the compute usage. Transactions that don't declare a limit are given the max (1.4M CUs) — wasteful and deprioritized. |
| 8 | **D** | Solana accounts must maintain a rent-exempt minimum balance. A transfer that would drain below it is rejected. Both the sender's token account balance and the fee can trigger this. |
| 9 | **B** | `confirmTransaction` resolving means the tx landed. `result.value.err !== null` means the program instructions failed on-chain. |
| 10 | **B** | Jupiter returns a base64-encoded `VersionedTransaction`. You must deserialize and sign it before sending. |

---

**Passing score:** 7/10
