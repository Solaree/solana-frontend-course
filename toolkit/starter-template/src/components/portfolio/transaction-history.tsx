"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AlertCircle, ArrowUpRight, History } from "lucide-react";
import { useTransactionHistory } from "@/hooks/use-transaction-history";
import { formatRelativeTime, explorerTxUrl, truncateAddress } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";
import { RefreshButton } from "@/components/ui/refresh-button";

export function TransactionHistory() {
  const { connected } = useWallet();
  const { data: txs, isLoading, error, refetch } = useTransactionHistory(10);

  if (!connected) return null;

  return (
    <div className="card-glow overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Recent Transactions
          </span>
          {txs && txs.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {txs.length}
            </span>
          )}
        </div>
        <RefreshButton onRefetch={refetch} label="Refresh transactions" />
      </div>

      {/* Body */}
      {isLoading ? (
        <div
          className="divide-y divide-border"
          aria-busy="true"
          aria-label="Loading transactions"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded-lg bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-3.5 w-12 animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-6">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">
              Couldn&apos;t load transactions
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
      ) : !txs || txs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <History className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-xs text-muted-foreground">
              Your transaction history will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {txs.map((tx) => (
            <a
              key={tx.signature}
              href={explorerTxUrl(tx.signature, CLUSTER)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent/40"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-sm font-medium text-foreground">
                    {truncateAddress(tx.signature, 8)}
                  </span>
                  {tx.err && (
                    <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      Failed
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tx.blockTime
                    ? formatRelativeTime(tx.blockTime)
                    : `Slot ${tx.slot.toLocaleString()}`}
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
