"use client";

import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AlertCircle, Coins } from "lucide-react";
import { useTokenAccounts } from "@/hooks/use-token-accounts";
import { useTokenPrices } from "@/hooks/use-token-prices";
import { SWAP_TOKEN_MAP } from "@/lib/jupiter";
import { formatTokenAmount, formatUsd } from "@/lib/format";
import { Address } from "@/components/ui/address";
import { TokenIcon } from "@/components/ui/token-icon";
import { RefreshButton } from "@/components/ui/refresh-button";

export function TokenList() {
  const { connected } = useWallet();
  const { data: tokens, isLoading, error, refetch, isFetching } = useTokenAccounts();

  // Collect all held mints so we can batch-fetch their prices
  const tokenMints = useMemo(
    () => (tokens ?? []).map((t) => t.mint),
    [tokens]
  );
  const { data: prices } = useTokenPrices(tokenMints);

  if (!connected) return null;

  return (
    <div className="card-glow overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Token Balances</span>
          {tokens && tokens.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {tokens.length}
            </span>
          )}
        </div>
        <RefreshButton onRefetch={refetch} label="Refresh token balances" />
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="divide-y divide-border" aria-busy="true" aria-label="Loading tokens">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 animate-pulse rounded-lg bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded-lg bg-muted" />
                </div>
              </div>
              <div className="h-3.5 w-16 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-6">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Couldn't load tokens</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Network error"}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : !tokens || tokens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Coins className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No tokens yet</p>
            <p className="text-xs text-muted-foreground">
              Tokens you receive will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tokens.map((token) => {
            const price = prices?.[token.mint];
            const usdValue = price != null ? token.uiAmount * price : undefined;
            const known = SWAP_TOKEN_MAP.get(token.mint);

            return (
              <div
                key={token.address}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-3">
                  <TokenIcon mint={token.mint} size={36} />
                  <div className="space-y-0.5">
                    {known ? (
                      <p className="text-sm font-medium text-foreground">{known.symbol}</p>
                    ) : (
                      <Address
                        address={token.mint}
                        chars={4}
                        showExplorer={false}
                        className="text-sm font-medium"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {known ? (
                        <Address address={token.mint} chars={4} showExplorer={false} className="text-xs" />
                      ) : (
                        `${token.decimals} decimals`
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-mono tabular-nums text-sm font-semibold text-foreground">
                    {formatTokenAmount(token.uiAmount)}
                  </span>
                  {usdValue !== undefined && (
                    <span className="block font-mono tabular-nums text-xs text-muted-foreground">
                      {formatUsd(usdValue)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
