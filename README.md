# Solana Frontend Development — Colosseum Hackathon Course

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

All templates are pre-wired and ready to `npm install --legacy-peer-deps && npm run dev`.

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
npm install --legacy-peer-deps
cp .env.example .env.local   # add your RPC URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll see a wallet connect button, SOL balance, and token list — ready to extend.

---

## Stack Used Throughout

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **@solana/web3.js** v1.x
- **@solana/wallet-adapter-react**
- **@tanstack/react-query** for RPC caching
- **Helius RPC** (swap in any provider)
