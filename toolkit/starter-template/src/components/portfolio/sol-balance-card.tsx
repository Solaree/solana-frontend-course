"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AlertCircle, Wifi } from "lucide-react";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useTokenPrices, getSolPrice } from "@/hooks/use-token-prices";
import { formatTokenAmount, formatUsd } from "@/lib/format";
import { RefreshButton } from "@/components/ui/refresh-button";

export function SolBalanceCard() {
  const { connected } = useWallet();

  const {
    data: balance,
    isLoading: balanceLoading,
    error: balanceError,
    refetch,
    isFetching: balanceFetching,
  } = useSolBalance();

  const {
    data: prices,
    isLoading: priceLoading,
    error: priceError,
  } = useTokenPrices();

  const solPrice = getSolPrice(prices);
  const usdValue = balance !== undefined && solPrice !== undefined
    ? balance * solPrice
    : undefined;

  if (!connected) {
    return (
      <div className="card-glow rounded-2xl border border-border bg-card p-6">
        <p className="text-center text-sm text-muted-foreground">
          Connect your wallet to view your balance
        </p>
      </div>
    );
  }

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6">
      {/* Card header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">SOL Balance</span>
          <span
            className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
            title="Live updates via WebSocket"
          >
            <Wifi className="h-2.5 w-2.5" aria-hidden />
            live
          </span>
        </div>
        <RefreshButton onRefetch={refetch} label="Refresh balance" />
      </div>

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {balanceFetching && "Refreshing SOL balance"}
        {!balanceFetching && balance !== undefined &&
          `SOL balance: ${formatTokenAmount(balance, 4)} SOL`}
        {balanceError && "Failed to load SOL balance"}
      </div>

      {/* Balance display */}
      {balanceLoading && balance === undefined ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading balance">
          <div className="h-12 w-44 animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : balanceError ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Couldn't load balance</p>
            <p className="text-xs text-muted-foreground">
              {balanceError instanceof Error ? balanceError.message : "Network error — please try again."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-medium text-primary hover:underline focus-visible:outline-none"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            <span className="font-mono tabular-nums text-4xl font-bold tracking-tight text-foreground">
              {formatTokenAmount(balance ?? 0, 4)}
            </span>
            <span className="mb-1 text-base font-medium text-muted-foreground">SOL</span>
          </div>

          {/* USD value display */}
          <div className="mt-1">
            {priceLoading && usdValue === undefined ? (
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            ) : priceError ? (
              <p className="text-xs text-muted-foreground">— USD</p>
            ) : usdValue !== undefined ? (
              <p className="font-mono tabular-nums text-sm text-muted-foreground">
                ≈ {formatUsd(usdValue)}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
