# Solana Frontend Development — Colosseum Hackathon Course
![](https://github-production-user-asset-6210df.s3.amazonaws.com/115794865/580292416-67c229ed-e1fb-4b46-bff9-e7bae57c8249.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260418%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260418T085016Z&X-Amz-Expires=300&X-Amz-Signature=d2e9dabaa4a40bea9a287a8df7777ab51be356591dab61592460c24332d41b06&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

A 4-lecture hands-on module for frontend developers transitioning from Web2 to building production-ready Solana dApps. Every lecture comes with working code examples, a quiz, and a coding assignment.

---

## Who This Is For

- Frontend developers with React/Next.js experience (no Rust required)
- Web2 developers entering Solana for the first time
- Hackathon participants who want a plug-and-play starting point

## Prerequisites

- React (hooks, context) — intermediate comfort
- TypeScript basics
- Node.js ≥ 18 installed

---

## Course Structure

| # | Lecture | Focus |
|---|---------|-------|
| 1 | [Solana Frontend Foundations](./lectures/lecture-01-foundations/README.pdf) | Wallet connection, account model, first dApp |
| 2 | [Reading Blockchain State](./lectures/lecture-02-reading-state/README.pdf) | Balances, tokens, real-time subscriptions |
| 3 | [Building & Sending Transactions](./lectures/lecture-03-transactions/README.pdf) | Transaction anatomy, program calls, error handling |
| 4 | [Production-Ready dApps](./lectures/lecture-04-production/README.pdf) | State management, performance, security, deployment |

---

## Practical Toolkit

The [`toolkit/`](./toolkit/README.md) directory contains plug-and-play starter templates:

| Template | What It Provides |
|----------|-----------------|
| [starter-template](./toolkit/starter-template/) | Full Next.js 15 dApp — wallet adapter, live SOL balance, SPL tokens, transaction history, send SOL form, **Jupiter Token Swap**, **Token Prices**, devnet airdrop, **Secure RPC proxy**, error boundaries |

All templates are pre-wired and ready to `pnpm install --legacy-peer-deps && pnpm dev`.

---

## Per-Lecture Resources

Each lecture folder contains:

```
lecture-XX-name/
├── README.md       ← Lecture content with code examples
├── README.pdf      ← Compiled lecture into PDF slides
├── quiz.md         ← 10-question quiz with answer key
├── quiz.pdf        ← Compiled quiz into PDF slides
├── assignment.md   ← Coding assignment with grading rubric
└── assignment.pdf  ← Compiled assignment into PDF slides
```

---

## Quick Start — Run the Starter Template

```bash
cd toolkit/starter-template
pnpm install --legacy-peer-deps
cp .env.example .env.local   # add your RPC URL
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You'll see a wallet connect button, SOL balance, and token list — ready to extend.

You can also check the mainnet-ready deployment [here](https://starter-template-gold.vercel.app)

---

## FAQ

Common questions (setup, wallets, RPC, errors, workflow) → [FAQ.md](./FAQ.md)

---

## Stack Used Throughout

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **@solana/web3.js** v1.x
- **@solana/wallet-adapter-react**
- **@tanstack/react-query** for RPC caching
- **Helius RPC** (swap in any provider)
