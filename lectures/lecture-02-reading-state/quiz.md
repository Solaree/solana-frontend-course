# Lecture 2 Quiz — Reading Blockchain State & Token Data

10 questions. Recommended time: 15 minutes.

---

## Questions

**Q1.** A user holds 500 USDC. USDC has 6 decimals. What will `info.tokenAmount.amount` return?

- A) `500`
- B) `500000000`
- C) `500000`
- D) `5000000`

---

**Q2.** What is an Associated Token Account (ATA)?

- A) A special account that holds all tokens for a wallet in a single address
- B) A deterministic token account address derived from `(owner, mint)` that serves as the canonical balance account
- C) An account managed by the Token Program that aggregates all SPL mints
- D) A multi-signature account for team treasuries

---

**Q3.** You call `connection.onAccountChange(pubkey, callback)`. What is the most important cleanup step?

- A) Setting the callback to `null`
- B) Calling `connection.removeAccountChangeListener(subscriptionId)` when the component unmounts
- C) Clearing the WebSocket manually with `connection.ws.close()`
- D) Nothing — the subscription auto-cancels after 60 seconds

---

**Q4.** Which React Query option controls how long data is considered fresh (no refetch needed)?

- A) `gcTime`
- B) `cacheTime`
- C) `staleTime`
- D) `freshTime`

---

**Q5.** You have 3 accounts you need to read. Which approach minimizes RPC round trips?

- A) `await Promise.all([getBalance(a), getBalance(b), getBalance(c)])`
- B) Three sequential `getAccountInfo` calls
- C) `connection.getMultipleAccountsInfo([a, b, c])`
- D) `getProgramAccounts` with a filter

---

**Q6.** Why should you filter out token accounts with `uiAmount === 0`?

- A) Zero-balance accounts cause RPC errors
- B) They are invalid and will throw an exception when parsed
- C) Wallets accumulate dust token accounts over time — showing them clutters the UI
- D) The Token Program automatically closes zero-balance accounts

---

**Q7.** A token has `decimals: 9` and `rawAmount: 1500000000`. What is the human-readable balance?

- A) 1,500,000,000
- B) 1.5
- C) 15
- D) 0.0000015

---

**Q8.** Why is `NEXT_PUBLIC_` prefixed RPC URLs a security concern?

- A) They are encrypted and can't be read by the server
- B) They are embedded in the browser bundle and visible to all users — exposing private API keys
- C) They only work in development, not production
- D) Next.js blocks API calls from `NEXT_PUBLIC_` variables

---

**Q9.** Which Helius API method is the most efficient way to get a wallet's token balances WITH metadata (name, symbol, image)?

- A) `getTokenAccountsByOwner` + Metaplex metadata fetch per token
- B) `getProgramAccounts` on the Token Program
- C) `getAssetsByOwner` from the DAS API
- D) Jupiter Token List + `getParsedTokenAccountsByOwner`

---

**Q10.** Which `queryKey` correctly scopes a React Query cache entry to a specific wallet's SOL balance?

```ts
// A
queryKey: ["solBalance"]

// B
queryKey: ["solBalance", publicKey?.toBase58()]

// C
queryKey: ["solBalance", connection.rpcEndpoint]

// D
queryKey: ["balance", "sol", Date.now()]
```

- A) Option A
- B) Option B
- C) Option C
- D) Option D

---

## Answer Key

| Q | Answer | Explanation |
|---|--------|-------------|
| 1 | **B** | USDC has 6 decimals: 500 × 10^6 = 500,000,000. Raw amount = UI amount × 10^decimals. |
| 2 | **B** | ATA = deterministic address from (owner, mint). Every program can find your token balance without you revealing the address. |
| 3 | **B** | Always call `removeAccountChangeListener(subId)` in the cleanup function — unmanaged subscriptions leak WebSocket connections. |
| 4 | **C** | `staleTime` — how long before React Query considers data stale and eligible for a background refetch. `gcTime` (formerly `cacheTime`) controls how long unused data stays in memory. |
| 5 | **C** | `getMultipleAccountsInfo` fetches N accounts in a single RPC call. `Promise.all` makes N parallel calls — still N round trips. |
| 6 | **C** | Token accounts persist even when emptied. Wallets accumulate hundreds of dust accounts. Filter them for a clean UI. |
| 7 | **B** | 1,500,000,000 / 10^9 = 1.5 |
| 8 | **B** | `NEXT_PUBLIC_` variables are inlined into the JS bundle at build time — anyone who opens DevTools can see them. |
| 9 | **C** | Helius `getAssetsByOwner` returns enriched metadata in one call. The other options require N+1 fetches. |
| 10 | **B** | Include the wallet address in the key — otherwise all wallets share one cache entry and the wrong balance is shown on wallet switch. |

---

**Passing score:** 7/10
