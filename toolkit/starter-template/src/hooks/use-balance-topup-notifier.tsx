"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { showBalanceToast } from "@/components/ui/balance-toast";
import { truncateAddress } from "@/lib/format";
import { SWAP_TOKEN_MAP } from "@/lib/jupiter";
import { useSolBalance } from "./use-sol-balance";
import { useTokenAccounts } from "./use-token-accounts";

// Filter dust changes (rent reclaim from closing accounts ≈ 0.002 SOL,
// fee refunds, etc.). Anything bigger than this is a real top-up worth
// surfacing to the user.
const MIN_SOL_DELTA = 0.001;

const SOL_MINT = "So11111111111111111111111111111111111111112";

// ─── Symbol resolution ───────────────────────────────────────────────────────

function symbolFor(mint: string): string {
  if (mint === SOL_MINT) return "SOL";
  return SWAP_TOKEN_MAP.get(mint)?.symbol ?? truncateAddress(mint);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fires a "Received" toast whenever the connected wallet's SOL balance or
 * any SPL token balance increases — airdrops, swap outputs, transfers in,
 * lending withdrawals, etc.
 *
 * Mount once at the top of the tree. Skips the first reading of each balance
 * (so we don't spam on initial load) and resets baselines whenever the
 * connected wallet changes. Outgoing flows (e.g. lending deposits) are
 * surfaced separately — see `showBalanceToast({ kind: "deposited", … })`
 * called explicitly from the action hooks — because the wallet balance
 * decrease alone is too ambiguous to label correctly here.
 */
export function useBalanceTopUpNotifier() {
  const { publicKey } = useWallet();
  const { data: solBalance } = useSolBalance();
  const { data: tokenAccounts } = useTokenAccounts();

  const walletKey = publicKey?.toBase58() ?? null;

  // Per-wallet baselines. Reset when the connected wallet changes so we
  // never compare wallet-A's balance against wallet-B's.
  const lastWalletRef = useRef<string | null>(null);
  const prevSolRef = useRef<number | null>(null);
  const prevTokensRef = useRef<Map<string, number> | null>(null);

  if (lastWalletRef.current !== walletKey) {
    lastWalletRef.current = walletKey;
    prevSolRef.current = null;
    prevTokensRef.current = null;
  }

  // SOL balance — increases beyond dust threshold
  useEffect(() => {
    if (solBalance == null) return;
    const prev = prevSolRef.current;
    prevSolRef.current = solBalance;

    // First read is the baseline, not a top-up.
    if (prev == null) return;

    const delta = solBalance - prev;
    if (delta > MIN_SOL_DELTA) {
      showBalanceToast({
        kind: "received",
        symbol: "SOL",
        mint: SOL_MINT,
        amount: delta,
        newBalance: solBalance,
      });
    }
  }, [solBalance]);

  // Token balances — any increase, including newly-appearing accounts.
  // useTokenAccounts already filters out zero-balance accounts, so a brand-
  // new token shows up here as a transition from "missing" to a positive
  // amount, which we treat as a delta from 0.
  useEffect(() => {
    if (!tokenAccounts) return;

    const next = new Map<string, number>();
    for (const t of tokenAccounts) next.set(t.mint, t.uiAmount);

    const prev = prevTokensRef.current;
    prevTokensRef.current = next;

    if (prev == null) return;

    for (const [mint, amount] of next) {
      const prevAmount = prev.get(mint) ?? 0;
      const delta = amount - prevAmount;
      // Use a relative-precision threshold for tokens — different decimals
      // mean an absolute floor doesn't generalize. Skip changes smaller
      // than 1e-6 of the new balance (covers float-roundoff dust).
      if (delta > 0 && delta > amount * 1e-6) {
        showBalanceToast({
          kind: "received",
          symbol: symbolFor(mint),
          mint,
          amount: delta,
          newBalance: amount,
        });
      }
    }
  }, [tokenAccounts]);
}
