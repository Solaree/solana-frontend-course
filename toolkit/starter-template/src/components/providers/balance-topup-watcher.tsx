"use client";

import { useBalanceTopUpNotifier } from "@/hooks/use-balance-topup-notifier";

/**
 * Invisible mount point for `useBalanceTopUpNotifier`. Must live inside both
 * `SolanaProvider` (for the wallet context) and `QueryProvider` (for the
 * react-query balance hooks the notifier subscribes to).
 */
export function BalanceTopUpWatcher() {
  useBalanceTopUpNotifier();
  return null;
}
