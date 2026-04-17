# FAQ — Solana Frontend Course

Common questions from students working through the lectures and starter template. If yours isn't here, open an issue.

---

## Setup & Install

### Why does `pnpm install` need `--legacy-peer-deps`?

The Solana wallet-adapter packages still list `react@^18` as a peer dependency, but the starter template runs on React 19. `--legacy-peer-deps` tells the installer to ignore that mismatch — the libraries work fine on React 19 in practice.

### Can I use npm or yarn instead of pnpm?

Yes, but pnpm is recommended. Equivalents:

```bash
pnpm install --legacy-peer-deps
# or
yarn install
```

The commits and CI use pnpm, but nothing in the code is pnpm-specific.

### Which Node version should I use?

Node 18 or 20 (LTS). Node 22 works too. Node 16 and below will fail — Next.js 15 requires Node 18+.

### Does this work on Windows?

Use WSL2 (Ubuntu). Native Windows works for most things but occasionally trips on file-watching and path separators in scripts. WSL2 matches the macOS/Linux dev experience closely.

---

## Wallets & Devnet

### Which wallet should I install?

Any of these — the starter template auto-detects installed wallets:

- **Phantom** — most common, good default
- **Solflare** — strong mobile support
- **Backpack** — developer-friendly

Install one browser extension, create a wallet, and **switch it to Devnet** in the wallet's settings before using the starter template on devnet.

### How do I get devnet SOL for testing?

Three options, in order of reliability:

1. Click the **"Request Airdrop"** button in the starter template (uses the built-in devnet airdrop).
2. CLI: `solana airdrop 2 <YOUR_ADDRESS> --url devnet`
3. Web faucet: [faucet.solana.com](https://faucet.solana.com)

If the public faucet rate-limits you, use the [Helius faucet](https://www.helius.dev/faucet) with an account.

### Devnet vs mainnet — which should I use?

- **Devnet** for learning, assignments, and testing — SOL is free, transactions don't cost real money.
- **Mainnet** only when you're ready to deploy something real.

Set `NEXT_PUBLIC_CLUSTER=devnet` in `.env.local` while learning.

---

## RPC & Helius

### Do I need a Helius API key to run the starter template?

For **devnet** — no, the public endpoint works. For **mainnet** — yes, public mainnet RPCs rate-limit heavily and will break features like token prices and swaps. Free Helius tier is plenty for development.

### Why is the RPC URL set to `/api/rpc` by default?

That's a Next.js API route that proxies requests to Helius server-side, so your API key never ships to the browser. Never put a paid RPC key behind `NEXT_PUBLIC_` — it will be visible in the client bundle.

### Can I use QuickNode / Triton / Alchemy instead?

Yes. Replace the URL in `src/app/api/rpc/route.ts` and set the provider's key as `HELIUS_API_KEY` (or rename the env var). The proxy pattern is provider-agnostic.

---

## Common Errors

### "Transaction simulation failed: Blockhash not found"

The blockhash expired before the transaction was sent (~60 seconds). Fetch a fresh blockhash right before signing, and don't cache it across user interactions.

### "Transaction simulation failed: insufficient lamports"

The wallet doesn't have enough SOL to cover the transfer **plus** the ~5,000 lamport transaction fee. On devnet, request another airdrop.

### "Wallet not connected" after clicking connect

Usually one of:
- Wallet extension is locked — open it and unlock.
- Wallet is on a different cluster than the app (e.g. wallet on mainnet, app on devnet).
- Browser blocked the popup — check for a blocked-popup icon in the address bar.

### `Module not found: Can't resolve 'pino-pretty'`

Harmless warning from `@solana/web3.js`'s optional logger. Safe to ignore, or add to `next.config.ts`:

```ts
webpack: (config) => {
  config.resolve.fallback = { ...config.resolve.fallback, 'pino-pretty': false };
  return config;
}
```

### Hydration mismatch on wallet button

The wallet adapter reads from `window` which doesn't exist during SSR. Wrap the wallet button in a client-only component or use `dynamic(..., { ssr: false })`.

---

## Course Workflow

### In what order should I take the lectures?

Sequentially — 1 → 4. Each lecture builds on primitives from the previous one. The assignments assume you've read the preceding lecture.

### Do I have to finish an assignment before moving on?

No, but it's strongly recommended. The quizzes check conceptual understanding; the assignments are where the pieces actually connect.

### Where do I submit assignments?

This repo is self-study — there's no central grader. Use the rubric in each `assignment.md` to self-evaluate, or share your solution in your cohort's channel if you're taking this as part of a program.

### Can I use this for a hackathon project?

Yes — that's the point of the `toolkit/starter-template`. It's pre-wired for wallet, balance, tokens, swaps, and a secure RPC proxy, so you can skip the boilerplate and focus on your idea.
