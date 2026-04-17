---
marp: true
---

# Assignment 4 — Production-Ready Wallet App

**Estimated time:** 2–3 hours  
**Difficulty:** Advanced  

---

## Objective

Take your previous assignments and transform the best features into a production-ready dApp. Focus on resilience, security, and polish — not new features.

---

## Requirements

### Core (required for passing)

1. **RPC proxy** via a Next.js API route:
   - `HELIUS_API_KEY` (or similar) is NOT in `NEXT_PUBLIC_` variables
   - All RPC calls go through `/api/rpc`
   - Direct RPC endpoint falls back to the public one only in development

2. **Error boundary** wrapping the entire app:
   - Custom fallback UI (not React's default red error overlay)
   - "Try again" button that resets the boundary
   - Console log of the caught error

---

3. **Wallet change detection**:
   - When the user disconnects or switches wallets, all React Query cache is cleared
   - No stale data from the previous wallet leaks into the new session

4. **Cluster indicator**:
   - Devnet/testnet displays a visible badge in the header
   - Mainnet shows nothing (or a neutral indicator)
   - Switching clusters (if supported) clears the cache

---

5. **Accessibility review** — fix all of:
   - Every interactive element uses `<button>` or `<a>`, never `<div onClick>`
   - All inputs have visible `<label>` elements
   - Focus rings are visible (not removed with `outline-none` alone)
   - Transaction status changes are announced via `aria-live`
   - Touch targets are ≥ 40px tall

6. **Environment variable documentation** — a `.env.example` file that lists every variable with a comment explaining what it is and where to get it

---

### Stretch goals

7. **Signature-based auth** — implement a "Sign in with Solana" flow:
   - Generate a nonce on the server
   - Ask the wallet to sign a message: `"Sign in to [App Name]: [nonce]"`
   - Verify the signature server-side
   - Issue a session cookie (or return a JWT)

8. **Error monitoring** — integrate Sentry (free tier):
   - Errors from `ErrorBoundary.componentDidCatch` are sent to Sentry
   - Transaction failures are captured as Sentry events with the signature attached

---

9. **E2E test** — write one Playwright test that:
   - Loads the app
   - Connects a mock wallet (use `@solana/wallet-adapter-mock`)
   - Verifies the SOL balance card renders

10. **CI** — add a GitHub Actions workflow that runs `pnpm build` and `pnpm tsc --noEmit` on every push to `main`

---

## Setup

Build on Assignment 2 or 3, or start fresh from the toolkit starter:

```bash
cp -r ../../toolkit/starter-template ./assignment-04
cd assignment-04
pnpm install
```

Additional packages for stretch goals:

```bash
# Signature verification
pnpm add tweetnacl bs58

# Sentry
pnpm add @sentry/nextjs

# Playwright
pnpm add -D @playwright/test
npx playwright install chromium
```

---

## .env.example to Create

```bash
# Solana RPC
# Get a free API key at https://helius.dev
HELIUS_API_KEY=your_helius_api_key_here

# Cluster — "devnet" or "mainnet-beta"
NEXT_PUBLIC_CLUSTER=devnet

# Public RPC URL (browser-safe, non-secret)
# In production, point this to your proxy: /api/rpc
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Sentry (optional, for error monitoring)
SENTRY_DSN=your_sentry_dsn_here
```

---

## Grading Rubric

| Criterion | Points | Notes |
|-----------|--------|-------|
| RPC proxy: key not in NEXT_PUBLIC_ | 20 | Must pass code review — grep for the key |
| Error boundary with custom fallback | 15 | Renders, "try again" resets it |
| Wallet change clears cache | 15 | Verifiable by switching wallets |
| Cluster badge (devnet shows, mainnet hidden) | 10 | Correct on both clusters |
| All 5 accessibility checks pass | 20 | Keyboard nav, labels, focus rings, aria-live, touch targets |
| `.env.example` present and documented | 5 | Every variable explained |

---

| Criterion | Points | Notes |
|-----------|--------|-------|
| `pnpm build` passes with no errors | 10 | CI-ready |
| No TypeScript errors | 5 | `pnpm tsc --noEmit` |
| **Total** | **100** | |
| Sign in with Solana (stretch) | +20 | Server verifies signature |
| Sentry integration (stretch) | +10 | Errors reach Sentry dashboard |
| Playwright E2E test (stretch) | +15 | Test passes in CI |
| GitHub Actions CI (stretch) | +10 | Workflow file, builds green |

---

## Final Submission Checklist

Before submitting, verify:

- [ ] `pnpm build` succeeds with no errors or warnings
- [ ] `pnpm tsc --noEmit` passes
- [ ] API key is NOT in the browser bundle (check `pnpm build` output in `.next/static/chunks/`)
- [ ] Wallet switch → old data cleared (manually test: connect Wallet A, check balance, switch to Wallet B, verify balance updates)

---

- [ ] Devnet badge visible in dev, hidden on mainnet
- [ ] All form inputs have visible labels
- [ ] Tab key navigates through all interactive elements in logical order
- [ ] Focus ring visible on every focusable element
- [ ] `.env.example` committed (not `.env.local`)

---

## Capstone Context

This assignment is your portfolio piece. A recruiter or hackathon judge reviewing your code should find:

1. **No exposed secrets** — instant disqualification if found
2. **Error handling at every layer** — component errors, RPC errors, program errors
3. **Accessible UI** — shows attention to craft
4. **Clean TypeScript** — no `any`, no type-as-any casts
5. **Working app** — the deployed URL loads and connects a wallet on the first try

Ship it. Then go build something new.
