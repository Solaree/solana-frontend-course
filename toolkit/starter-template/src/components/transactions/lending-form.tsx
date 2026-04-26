"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ChevronDown,
  Loader2,
  TrendingUp,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  useKaminoMarkets,
  useSaveMarkets,
  useLendingExecution,
  useLendingPosition,
  type LendingProtocol,
  type LendingAction,
} from "@/hooks/use-lending";
import {
  useJitoInfo,
  useJitoStakingExecution,
} from "@/hooks/use-jito-staking";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useTokenAccounts } from "@/hooks/use-token-accounts";
import { LENDING_TOKENS, type LendingToken, type LendingReserve } from "@/lib/lending";
import { JITOSOL_MINT, SOL_MINT } from "@/lib/staking";
import { CLUSTER } from "@/lib/solana";
import { formatTokenAmount } from "@/lib/format";
import { TokenIcon } from "@/components/ui/token-icon";
import { showBalanceToast } from "@/components/ui/balance-toast";

// Jito gets first-class billing alongside the lending protocols. The form
// reuses the same UI scaffolding and only switches a few labels + the
// underlying executor when "jito" is selected.
type EarnProtocol = LendingProtocol | "jito";

const PROTOCOLS: { id: EarnProtocol; label: string }[] = [
  { id: "kamino", label: "Kamino" },
  { id: "save", label: "Save" },
  { id: "jito", label: "Jito" },
];

const FILL_OPTIONS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "Max", pct: 1 },
];

const SOL_TOKEN: LendingToken =
  LENDING_TOKENS.find((t) => t.mint === SOL_MINT) ?? LENDING_TOKENS[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAPY(apy: number): string {
  if (!apy || !isFinite(apy)) return "—";
  return `${(apy * 100).toFixed(2)}%`;
}

function toBaseUnits(amount: number, decimals: number): string {
  return Math.floor(amount * 10 ** decimals).toString();
}

function protocolLabel(p: EarnProtocol): string {
  if (p === "kamino") return "Kamino";
  if (p === "save") return "Save Finance";
  return "Jito";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LendingForm() {
  const { connected, publicKey } = useWallet();
  const { data: solBalance } = useSolBalance();
  const { data: tokenAccounts } = useTokenAccounts();
  const walletKey = publicKey?.toBase58() ?? null;

  const [protocol, setProtocol] = useState<EarnProtocol>("kamino");
  const [action, setAction] = useState<LendingAction>("deposit");
  const [selectedToken, setSelectedToken] = useState<LendingToken>(
    LENDING_TOKENS[1] // USDC default
  );
  const [inputAmount, setInputAmount] = useState("");
  // Tracks whether the current input was set by clicking "Max" on a withdraw.
  // Withdrawing the full deposit needs to send `u64::MAX` rather than the
  // displayed number — interest accrues between the read and the on-chain
  // refresh, and a literal amount would leave dust behind. Cleared on any
  // typed edit or Fill % click.
  const [isMaxWithdraw, setIsMaxWithdraw] = useState(false);

  const isJito = protocol === "jito";

  // Jito only stakes SOL — auto-snap the token whenever the user toggles
  // into Jito so they never see "USDC stake" or similar confusing state.
  useEffect(() => {
    if (isJito && selectedToken.mint !== SOL_MINT) {
      setSelectedToken(SOL_TOKEN);
      setInputAmount("");
      setIsMaxWithdraw(false);
    }
  }, [isJito, selectedToken.mint]);

  const { data: kaminoMarkets, isLoading: kaminoLoading, error: kaminoError } =
    useKaminoMarkets();
  const { data: saveMarkets, isLoading: saveLoading, error: saveError } =
    useSaveMarkets();
  const { data: jitoInfo, isLoading: jitoLoading, error: jitoError } =
    useJitoInfo();

  // Markets / loading / error switch by protocol.
  const markets =
    protocol === "kamino" ? kaminoMarkets : protocol === "save" ? saveMarkets : undefined;
  const marketsLoading =
    protocol === "kamino"
      ? kaminoLoading
      : protocol === "save"
        ? saveLoading
        : jitoLoading;
  const marketsError =
    protocol === "kamino"
      ? kaminoError
      : protocol === "save"
        ? saveError
        : jitoError;

  // Two executors live side-by-side; only one drives the UI at a time.
  // Both expose the same `{ status, reset }` shape so the button render
  // logic doesn't have to branch on which protocol's running.
  const lendingExec = useLendingExecution(
    isJito ? "kamino" : (protocol as LendingProtocol)
  );
  const jitoExec = useJitoStakingExecution();
  const { status, reset } = isJito ? jitoExec : lendingExec;

  // Reserve data for selected token (Kamino/Save only).
  const reserve: LendingReserve | undefined = useMemo(() => {
    if (!markets) return undefined;
    return markets.find(
      (r) =>
        r.symbol.toUpperCase() === selectedToken.symbol.toUpperCase() ||
        r.mint === selectedToken.mint
    );
  }, [markets, selectedToken]);

  // True when the user picks an LST that the active lending protocol
  // doesn't have in its main market (e.g. JitoSOL on Save). We render an
  // explicit hint rather than letting the user click into a guaranteed
  // failure.
  const tokenUnavailable =
    !isJito && !marketsLoading && !marketsError && markets != null && reserve == null;

  // Wallet balances we'll need.
  const walletSol = solBalance ?? 0;
  const walletJitoSol =
    tokenAccounts?.find((t) => t.mint === JITOSOL_MINT)?.uiAmount ?? 0;
  const walletSelected = useMemo(() => {
    if (selectedToken.mint === SOL_MINT) return walletSol;
    return (
      tokenAccounts?.find((t) => t.mint === selectedToken.mint)?.uiAmount ?? 0
    );
  }, [selectedToken, walletSol, tokenAccounts]);

  // Currently-deposited amount on lending protocols.
  const { data: depositedBalance = 0, isLoading: positionLoading } =
    useLendingPosition(
      isJito ? "kamino" : (protocol as LendingProtocol),
      selectedToken.mint,
      isJito ? null : walletKey // skip the lending fetch entirely on Jito
    );

  // For Jito-unstake: the "deposited" is the SOL value of held JitoSOL.
  const jitoSolValue = jitoInfo
    ? walletJitoSol * jitoInfo.exchangeRate
    : 0;

  // Final balance shown above the input — switches with protocol + action.
  const balance = isJito
    ? action === "deposit"
      ? walletSol
      : jitoSolValue
    : action === "withdraw"
      ? depositedBalance
      : walletSelected;

  function fillAmount(pct: number) {
    if (balance <= 0) return;
    // SOL deposits / stakes need to leave room for tx fee, ATAs, and
    // protocol-specific one-shot account creations. Detail per protocol:
    //
    //   Kamino first deposit: UserMetadata (~0.002), obligation (~0.0135),
    //   user LUT (~0.0014), and a Farms UserState (~0.0073) per reserve.
    //   Round up to 0.06 to stay safe for both deposit-side and debt-side
    //   farm states.
    //
    //   Save first deposit: obligation + ATAs (~0.005). Round up to 0.02.
    //
    //   Jito stake: just the JitoSOL ATA (~0.00204) + the deposit-side
    //   priority fee (~0.0005). Round up to 0.005.
    //
    //   Withdrawals/unstakes don't touch the wallet's SOL balance beyond
    //   the tx fee, so no reserve is needed.
    let reserve_ = 0;
    if (action === "deposit" && selectedToken.mint === SOL_MINT) {
      if (protocol === "kamino") reserve_ = 0.06;
      else if (protocol === "save") reserve_ = 0.02;
      else if (protocol === "jito") reserve_ = 0.005;
    }
    const max = Math.max(0, balance - reserve_);
    const val =
      pct >= 1 ? max : parseFloat((max * pct).toFixed(selectedToken.decimals));
    setInputAmount(val > 0 ? val.toString() : "");
    // U64_MAX wire trick only applies to lending withdrawals — Jito
    // unstake routes through Jupiter which takes an exact JitoSOL amount.
    setIsMaxWithdraw(pct >= 1 && action === "withdraw" && !isJito);
  }

  const handleSubmit = useCallback(async () => {
    const num = parseFloat(inputAmount);
    if (!num || num <= 0) return;

    let sig: string | null = null;

    // The actual JitoSOL amount that leaves the wallet on Jito unstake —
    // captured here so the "Withdrawn · Jito" toast below can show the
    // real outgoing amount instead of the SOL the user typed.
    let jitoSolSpent = 0;

    if (isJito) {
      // Jito stake = SOL lamports; unstake = JitoSOL base units derived
      // from the SOL input via the current exchange rate. For Max unstake
      // we send the wallet's exact JitoSOL balance to drain the position
      // cleanly (no dust left behind).
      let amountBase: string;
      if (action === "deposit") {
        amountBase = toBaseUnits(num, 9);
      } else {
        const jitoUi =
          isMaxWithdraw || !jitoInfo
            ? walletJitoSol
            : num / jitoInfo.exchangeRate;
        jitoSolSpent = jitoUi;
        amountBase = toBaseUnits(jitoUi, 9);
      }
      sig = await jitoExec.execute(
        action === "deposit" ? "stake" : "unstake",
        amountBase
      );
    } else {
      // Lending path — same wire format as before. U64_MAX on max-withdraw
      // avoids a dust remainder from interest accrued between the position
      // read and the on-chain settle.
      const amountBase =
        isMaxWithdraw && action === "withdraw"
          ? "18446744073709551615"
          : toBaseUnits(num, selectedToken.decimals);
      sig = await lendingExec.execute(action, selectedToken.mint, amountBase);
    }

    if (sig) {
      // Two-leg notification model:
      //   • Incoming leg (token arriving in the wallet) → caught
      //     automatically by the Received notifier from the balance bump.
      //   • Outgoing leg (token leaving the wallet) → fired manually here,
      //     because a balance going DOWN is too ambiguous to label
      //     correctly without context (was it a fee? a transfer? a swap?).
      //
      // Concretely:
      //   stake   → manual "Deposited · Jito" (-SOL)   + auto Received JitoSOL
      //   unstake → manual "Withdrawn · Jito" (-JitoSOL) + auto Received SOL
      //   deposit → manual "Deposited · X" (-token)    + (no incoming token)
      //   withdraw → (lending: no outgoing wallet token to label)         + auto Received underlying
      if (action === "deposit") {
        showBalanceToast({
          kind: "deposited",
          symbol: selectedToken.symbol,
          mint: selectedToken.mint,
          amount: num,
          protocolLabel: protocolLabel(protocol),
          subtitle: isJito
            ? "Now earning Jito staking yield"
            : "Now earning supply yield",
        });
      } else if (isJito && jitoSolSpent > 0) {
        // Unstake: pair the auto Received-SOL toast with an explicit
        // Withdrawn-JitoSOL toast so the user sees both legs of the swap.
        showBalanceToast({
          kind: "withdrawn",
          symbol: "JitoSOL",
          mint: JITOSOL_MINT,
          amount: jitoSolSpent,
          protocolLabel: "Jito",
          subtitle: `≈ ${formatTokenAmount(num)} SOL inbound`,
        });
      }

      setInputAmount("");
      setIsMaxWithdraw(false);
      setTimeout(() => reset(), 2_000);
    }
  }, [
    inputAmount,
    isMaxWithdraw,
    selectedToken,
    action,
    protocol,
    isJito,
    jitoInfo,
    walletJitoSol,
    jitoExec,
    lendingExec,
    reset,
  ]);

  // ── Devnet notice ─────────────────────────────────────────────────────────
  if (CLUSTER !== "mainnet-beta") {
    return (
      <div className="card-glow rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-medium text-muted-foreground">Earn</h2>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Lending and staking use mainnet protocols (Kamino, Save, Jito).
          </p>
          <p className="text-xs text-muted-foreground/60">
            Set{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              NEXT_PUBLIC_CLUSTER=mainnet-beta
            </code>{" "}
            in .env.local
          </p>
        </div>
      </div>
    );
  }

  // ── Connect prompt ────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="card-glow rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-medium text-muted-foreground">Earn</h2>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to earn yield by lending or staking.
          </p>
        </div>
      </div>
    );
  }

  // ── Action labels ─────────────────────────────────────────────────────────
  const isSubmitting =
    status === "awaiting-approval" || status === "confirming";
  const hasValidInput = parseFloat(inputAmount) > 0;
  const submitDisabled = isSubmitting || !hasValidInput || tokenUnavailable;

  // Verb forms — explicit map beats a regex because past tenses are
  // irregular ("Withdraw" → "Withdrawn", "Unstake" → "Unstaked").
  const VERBS = isJito
    ? { in: "Stake", out: "Unstake", inPast: "Staked", outPast: "Unstaked" }
    : { in: "Deposit", out: "Withdraw", inPast: "Deposited", outPast: "Withdrawn" };
  const inLabel = VERBS.in;
  const outLabel = VERBS.out;
  const inLabelLower = inLabel.toLowerCase();
  const outLabelLower = outLabel.toLowerCase();
  const balanceLabel = isJito
    ? action === "deposit"
      ? "Balance"
      : "Staked"
    : action === "deposit"
      ? "Balance"
      : "Deposited";

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Earn</h2>
        {/* Protocol toggle */}
        <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-0.5">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProtocol(p.id);
                setInputAmount("");
                setIsMaxWithdraw(false);
              }}
              disabled={isSubmitting}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                protocol === p.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action tabs (Deposit/Withdraw OR Stake/Unstake) */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-background/40 p-1">
        {(["deposit", "withdraw"] as LendingAction[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAction(a);
              setInputAmount("");
              setIsMaxWithdraw(false);
            }}
            disabled={isSubmitting}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              action === a
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a === "deposit" ? (
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden />
            )}
            {a === "deposit" ? inLabel : outLabel}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            You {action === "deposit" ? inLabelLower : outLabelLower}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {balanceLabel}:{" "}
            {(action === "withdraw" && positionLoading) ||
            (isJito && action === "withdraw" && !jitoInfo)
              ? "…"
              : `${formatTokenAmount(balance)} ${
                  isJito && action === "withdraw" ? "SOL" : ""
                }`.trim()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={inputAmount}
            onChange={(e) => {
              setInputAmount(e.target.value);
              setIsMaxWithdraw(false);
            }}
            disabled={isSubmitting}
            className="min-w-0 flex-1 bg-transparent font-mono text-xl text-foreground placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-50"
          />
          <TokenSelect
            tokens={isJito ? [SOL_TOKEN] : LENDING_TOKENS}
            selected={selectedToken}
            onChange={(t) => {
              setSelectedToken(t);
              setInputAmount("");
              setIsMaxWithdraw(false);
            }}
            disabled={isSubmitting || isJito}
          />
        </div>

        {/* Jito unstake: a small hint that the SOL amount will be paid from
            the user's JitoSOL balance, so it doesn't look like the SOL input
            field is debiting plain SOL. */}
        {isJito && action === "withdraw" && (
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Routed via Jupiter — you spend{" "}
            {jitoInfo
              ? formatTokenAmount(walletJitoSol)
              : "…"}{" "}
            JitoSOL to receive SOL.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {FILL_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => fillAmount(opt.pct)}
              disabled={isSubmitting || balance <= 0}
              className="flex-1 rounded-lg border border-border bg-background/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* "Not available on this protocol" hint — fires when the user picks
          an LST that the active lending protocol doesn't list (e.g. JitoSOL
          on Save). Cleaner than failing at submit time. */}
      {tokenUnavailable && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs">
          <AlertTriangle
            className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400"
            aria-hidden
          />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedToken.symbol}
            </span>{" "}
            isn&apos;t available on {protocolLabel(protocol)}&apos;s main pool.
            Try a different protocol or token.
          </div>
        </div>
      )}

      {/* Stats panel — Kamino/Save show 3 lines, Jito shows just APY. */}
      {!tokenUnavailable && (reserve || marketsLoading || (isJito && jitoInfo)) && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-border/50 bg-background/20 px-4 py-3">
          {marketsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Loading rates…
            </div>
          ) : isJito && jitoInfo ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Staking APY</span>
                <span className="flex items-center gap-1 font-mono font-semibold text-green-400">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {formatAPY(jitoInfo.apy)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Exchange rate</span>
                <span className="font-mono text-foreground">
                  1 JitoSOL = {jitoInfo.exchangeRate.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pool TVL</span>
                <span className="font-mono text-foreground">
                  {formatTokenAmount(jitoInfo.tvlLamports / 1e9)} SOL
                </span>
              </div>
            </>
          ) : reserve ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Supply APY</span>
                <span className="font-mono font-semibold text-green-400">
                  {formatAPY(reserve.supplyAPY)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Borrow APY</span>
                <span className="font-mono text-foreground">
                  {formatAPY(reserve.borrowAPY)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Utilisation</span>
                <span className="font-mono text-foreground">
                  {reserve.utilizationRate
                    ? `${(reserve.utilizationRate * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Markets error */}
      {marketsError && !marketsLoading && (
        <p className="mt-3 text-center text-xs text-destructive">
          {marketsError instanceof Error
            ? marketsError.message
            : "Failed to load market rates"}
        </p>
      )}

      {/* Action button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitDisabled}
        aria-busy={isSubmitting}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {status === "awaiting-approval" ? "Approve in wallet…" : "Confirming…"}
          </>
        ) : status === "confirmed" ? (
          `${action === "deposit" ? VERBS.inPast : VERBS.outPast}!`
        ) : status === "failed" ? (
          "Try again"
        ) : (
          <>
            {action === "deposit" ? (
              <ArrowDownToLine className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowUpFromLine className="h-4 w-4" aria-hidden />
            )}
            {action === "deposit" ? inLabel : outLabel}
          </>
        )}
      </button>

      {/* Attribution */}
      <p className="mt-3 text-center text-[10px] text-muted-foreground/40">
        {protocol === "kamino"
          ? "Powered by Kamino Finance"
          : protocol === "save"
            ? "Powered by Save Finance"
            : "Powered by Jito · routed via Jupiter on unstake"}
      </p>

      {/* Screen reader status */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "awaiting-approval" && "Waiting for wallet approval"}
        {status === "confirming" && "Transaction submitted, confirming"}
        {status === "confirmed" &&
          (action === "deposit" ? `${inLabel} confirmed` : `${outLabel} confirmed`)}
        {status === "failed" && "Transaction failed"}
      </div>
    </div>
  );
}

// ─── Token selector ───────────────────────────────────────────────────────────

function TokenSelect({
  tokens,
  selected,
  onChange,
  disabled,
}: {
  tokens: LendingToken[];
  selected: LendingToken;
  onChange: (token: LendingToken) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card pl-2 pr-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        <TokenIcon mint={selected.mint} size={22} />
        <span>{selected.symbol}</span>
        {tokens.length > 1 && (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open && tokens.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-xl">
            {tokens.map((token) => (
              <button
                key={token.mint}
                type="button"
                onClick={() => {
                  onChange(token);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  token.mint === selected.mint
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground"
                }`}
              >
                <TokenIcon mint={token.mint} size={24} />
                <span>{token.symbol}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
