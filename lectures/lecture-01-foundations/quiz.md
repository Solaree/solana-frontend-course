# Lecture 1 Quiz — Solana Frontend Foundations

10 questions. Recommended time: 15 minutes. Answers at the bottom — try on your own first.

---

## Questions

**Q1.** What is the unit of SOL used internally by the Solana runtime?

- A) Wei
- B) Satoshi
- C) Lamport
- D) Gwei

---

**Q2.** You call `connection.getBalance(publicKey)` and get back `2500000000`. How much SOL does this wallet hold?

- A) 2,500,000,000 SOL
- B) 25 SOL
- C) 2.5 SOL
- D) 0.0000025 SOL

---

**Q3.** Which commitment level should you use by default for balance reads in a UI?

- A) `processed`
- B) `confirmed`
- C) `finalized`
- D) `recent`

---

**Q4.** In the account model, where is your wallet's SOL balance stored?

- A) Inside the wallet browser extension
- B) On a server maintained by the wallet provider
- C) On an account whose address is your public key, owned by the System Program
- D) Inside the token program's account data

---

**Q5.** Why should you wrap the `wallets` array in `useMemo` in your `SolanaProvider`?

- A) To reduce bundle size
- B) To prevent creating a new array on every render, which would cause reconnect loops
- C) `useMemo` is required by the wallet adapter API
- D) To enable React Server Components support

---

**Q6.** Which hook gives you access to the `Connection` object inside a component?

- A) `useWallet()`
- B) `useAnchorProvider()`
- C) `useConnection()`
- D) `useSolana()`

---

**Q7.** A user's component imports `useWallet` but forgets to add `"use client"` to the file. What happens?

- A) Nothing, it works fine
- B) TypeScript compilation error
- C) Hydration error at runtime because wallet adapter code only runs client-side
- D) The build fails with a webpack error

---

**Q8.** What does the `publicKey` field returned by `useWallet()` equal when no wallet is connected?

- A) An empty string `""`
- B) `null`
- C) `undefined`
- D) A zero-address PublicKey

---

**Q9.** You want to show a user's wallet address truncated as `7xKX...p2aB`. What implementation is correct?

```ts
// A
address.substring(0, 8)

// B
address.slice(0, 4) + "..." + address.slice(-4)

// C
address.split("").reverse().join("").slice(0, 8)

// D
address.replace(/(.{4}).*(.{4})/, "$1...$2")
```

- A) Option A
- B) Option B
- C) Option C
- D) Option D (regex approach)

---

**Q10.** Which of the following is NOT a valid commitment level in `@solana/web3.js`?

- A) `processed`
- B) `confirmed`
- C) `finalized`
- D) `pending`

---

## Answer Key

| Q | Answer | Explanation |
|---|--------|-------------|
| 1 | **C** | Lamports — 1 SOL = 1,000,000,000 lamports |
| 2 | **C** | 2,500,000,000 / 1,000,000,000 = 2.5 SOL |
| 3 | **B** | `confirmed` — fast enough for UI, safe enough for balance reads |
| 4 | **C** | SOL lives in an account at your public key address, owned by the System Program |
| 5 | **B** | Without `useMemo`, a new array reference triggers reconnect loops in the adapter |
| 6 | **C** | `useConnection()` returns `{ connection }` |
| 7 | **C** | Wallet adapter hooks use browser APIs (`window`, `navigator`) that aren't available on the server |
| 8 | **B** | `publicKey` is `null` when no wallet is connected — always null-check before use |
| 9 | **B** | `address.slice(0, 4) + "..." + address.slice(-4)` is clear and correct |
| 10 | **D** | `pending` is not a valid Solana commitment level |

---

**Passing score:** 7/10  
**Perfect score bonus:** Note that Q9 option D also works but is harder to read and maintain.
