import { WalletButton } from "@/components/wallet/wallet-button";
import { AirdropButton } from "@/components/wallet/airdrop-button";
import { SolBalanceCard } from "@/components/portfolio/sol-balance-card";
import { TokenList } from "@/components/portfolio/token-list";
import { TransactionHistory } from "@/components/portfolio/transaction-history";
import { SendSolForm } from "@/components/transactions/send-sol-form";
import { SwapForm } from "@/components/transactions/swap-form";
import { LendingForm } from "@/components/transactions/lending-form";
import { ClusterBadge } from "@/components/ui/cluster-badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Ambient gradient — purely decorative */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.15) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 18h13.5a2.5 2.5 0 000-5H6a2.5 2.5 0 010-5H19M4 18l2-2M4 18l2 2M19 8l-2-2M19 8l-2 2"
                  stroke="hsl(262,80%,65%)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight">
              Solana Starter
            </span>
            <ClusterBadge />
          </div>
          <div className="flex items-center gap-3">
            <AirdropButton />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Page */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {/* Section heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a wallet to view your assets and send transactions.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left — assets */}
          <div className="space-y-6">
            <ErrorBoundary>
              <SolBalanceCard />
            </ErrorBoundary>
            <ErrorBoundary>
              <TokenList />
            </ErrorBoundary>
            <ErrorBoundary>
              <TransactionHistory />
            </ErrorBoundary>
          </div>

          {/* Right — actions */}
          <div className="space-y-6">
            <ErrorBoundary>
              <SendSolForm />
            </ErrorBoundary>
            <ErrorBoundary>
              <SwapForm />
            </ErrorBoundary>
            <ErrorBoundary>
              <LendingForm />
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
