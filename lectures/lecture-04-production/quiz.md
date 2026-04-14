# Lecture 4 Quiz — Production-Ready dApps

10 questions. Recommended time: 15 minutes.

---

## Questions

**Q1.** Your dApp has a `HELIUS_API_KEY`. Where should this live?

- A) In `NEXT_PUBLIC_HELIUS_API_KEY` so the browser can call the RPC directly
- B) In a server-only env var, proxied through a Next.js API route
- C) In `localStorage` so each user session gets a fresh key
- D) In a JavaScript config file committed to the repo

---

**Q2.** A component with `useAccountChange` unmounts without calling `removeAccountChangeListener`. What is the consequence?

- A) Nothing — the runtime auto-cleans old subscriptions after 5 minutes
- B) The subscription persists, consuming a WebSocket connection slot and firing callbacks on a now-unmounted component
- C) The component throws an error on next render
- D) The WebSocket connection closes immediately

---

**Q3.** A user switches from Wallet A to Wallet B. React Query still shows Wallet A's balance. What's the fix?

- A) Add `refetchOnMount: true` to the query
- B) Call `queryClient.clear()` or `queryClient.invalidateQueries()` when the wallet public key changes
- C) Set `staleTime: 0`
- D) Use `localStorage` to track the last wallet address

---

**Q4.** An `ErrorBoundary` component needs `componentDidCatch`. What React class method sets the error state?

- A) `componentWillError`
- B) `shouldCatch`
- C) `static getDerivedStateFromError`
- D) `componentDidUpdate`

---

**Q5.** You want to update the UI before the transaction confirms (optimistic update). If the transaction fails, what must you do?

- A) Show a success toast and let the server reconcile
- B) Roll back the UI to the previous state and show an inline error where the action was taken
- C) Refresh the entire page
- D) Clear the React Query cache and let it refetch

---

**Q6.** Which Tailwind utility is required for numbers that update in-place (like a live SOL balance) to prevent digit jitter?

- A) `tracking-tight`
- B) `font-mono`
- C) `tabular-nums`
- D) `slashed-zero`

---

**Q7.** You want to announce transaction status to screen readers without moving focus. Which ARIA attribute on a container element achieves this?

- A) `aria-description`
- B) `aria-status`
- C) `aria-live="polite"`
- D) `role="alert"` (only for urgent announcements)

---

**Q8.** Your Solana dApp is deployed on Vercel. The `NEXT_PUBLIC_CLUSTER=mainnet-beta` env var is set. Should you still show a cluster indicator?

- A) No — mainnet is the default assumption; showing it adds noise
- B) Yes — always show the cluster on every page
- C) Only in the footer
- D) Only if the user is a developer

---

**Q9.** A user on mobile opens your dApp and taps "Send". The confirm button has a 24×24 px touch target. What is the problem?

- A) The button color may not contrast with the background
- B) Touch targets must be at least 40×40 px — a 24 px target is frequently missed on mobile
- C) 24×24 is fine for desktop but requires `@media (pointer: coarse)` override for touch
- D) The button needs a `type="submit"` attribute

---

**Q10.** Your dApp's SOL balance card re-renders 8 times when the wallet connects. Which is the most likely root cause?

- A) `useWallet()` triggers renders for every wallet state update
- B) `new Connection()` inside the component body creates a new object reference each render
- C) `useEffect` dependency arrays include unstable object references (like `connection` without memoization)
- D) React Query is polling too frequently

---

## Answer Key

| Q | Answer | Explanation |
|---|--------|-------------|
| 1 | **B** | `NEXT_PUBLIC_` variables are inlined into the browser bundle. Private keys must stay server-side and be proxied. |
| 2 | **B** | Subscriptions are not automatically cleaned up. The WebSocket slot is held open and the stale callback fires — a memory leak. |
| 3 | **B** | On wallet change, call `queryClient.clear()` to discard all cached data scoped to the previous wallet. |
| 4 | **C** | `static getDerivedStateFromError(error)` returns new state when an error is caught. `componentDidCatch` is for side effects (logging). |
| 5 | **B** | Roll back the UI and show an inline error at the point of action. A toast alone isn't enough — the user needs to see the state revert. |
| 6 | **C** | `tabular-nums` forces each digit to occupy equal horizontal space, preventing layout shifts as numbers change. |
| 7 | **C** | `aria-live="polite"` on a container announces text changes to screen readers without interrupting current speech. `role="alert"` is for urgent messages. |
| 8 | **A** | Show a cluster badge for devnet/testnet. On mainnet, suppress it — mainnet is the expected environment. |
| 9 | **B** | WCAG and platform guidelines require ≥ 40×40 px touch targets. 24 px icons need padding to reach this. |
| 10 | **C** | `connection` from `useConnection()` is stable, but if a component creates `new Connection()` in the body, each render gets a new reference, which invalidates `useEffect` dependencies and causes cascading re-renders. |

---

**Passing score:** 7/10
