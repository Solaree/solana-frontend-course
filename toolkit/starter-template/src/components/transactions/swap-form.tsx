"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowDownUp,
  ChevronDown,
  Loader2,
  Repeat2,
  Settings,
  Wallet,
} from "lucide-react";
import { useSwapQuote, useSwapExecution } from "@/hooks/use-swap";
import { useSolBalance } from "@/hooks/use-sol-balance";
import { useTokenAccounts } from "@/hooks/use-token-accounts";
import { SWAP_TOKENS, type SwapToken } from "@/lib/jupiter";
import { useWalletStore } from "@/store/wallet";
import { CLUSTER } from "@/lib/solana";
import { formatTokenAmount } from "@/lib/format";
import { TokenIcon } from "@/components/ui/token-icon";

const FILL_OPTIONS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "Max", pct: 1 },
];

const SLIPPAGE_PRESETS_BPS = [10, 50, 100]; // 0.1 %, 0.5 %, 1 %

function formatSlippage(bps: number): string {
  const pct = bps / 100;
  return `${pct.toFixed(pct < 1 ? 2 : pct % 1 === 0 ? 1 : 2)}%`;
}

export function SwapForm() {
  const { publicKey, connected } = useWallet();
  const { data: solBalance } = useSolBalance();
  const { data: tokenAccounts } = useTokenAccounts();

  const [inputToken, setInputToken] = useState<SwapToken>(SWAP_TOKENS[0]); // SOL
  const [outputToken, setOutputToken] = useState<SwapToken>(SWAP_TOKENS[1]); // USDC
  const [inputAmount, setInputAmount] = useState("");
  const slippageBps = useWalletStore((s) => s.slippageBps);
  const setSlippageBps = useWalletStore((s) => s.setSlippageBps);

  // Debounce the raw amount to avoid hammering the API on every keystroke
  const rawAmount = useMemo(() => {
    const num = parseFloat(inputAmount);
    if (!num || isNaN(num) || num <= 0) return "0";
    return Math.floor(num * 10 ** inputToken.decimals).toString();
  }, [inputAmount, inputToken]);

  const [debouncedAmount, setDebouncedAmount] = useState("0");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAmount(rawAmount), 500);
    return () => clearTimeout(timer);
  }, [rawAmount]);

  // Quote (routed through /api/swap/quote)
  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useSwapQuote(inputToken.mint, outputToken.mint, debouncedAmount, slippageBps);

  // Execution (routed through /api/swap)
  const { execute, status, reset, isLoading: swapLoading } = useSwapExecution();

  // Computed output
  const outputAmount = useMemo(() => {
    if (!quote) return "";
    const out = parseInt(quote.outAmount) / 10 ** outputToken.decimals;
    return formatTokenAmount(out, 6);
  }, [quote, outputToken]);

  // Rate display
  const rate = useMemo(() => {
    if (!quote) return "";
    const inAmt = parseInt(quote.inAmount) / 10 ** inputToken.decimals;
    const outAmt = parseInt(quote.outAmount) / 10 ** outputToken.decimals;
    if (inAmt === 0) return "";
    return formatTokenAmount(outAmt / inAmt, 6);
  }, [quote, inputToken, outputToken]);

  // Input token balance
  const inputBalance = useMemo(() => {
    if (inputToken.symbol === "SOL") return solBalance ?? 0;
    const account = tokenAccounts?.find((t) => t.mint === inputToken.mint);
    return account?.uiAmount ?? 0;
  }, [inputToken, solBalance, tokenAccounts]);

  function flipTokens() {
    const prev = inputToken;
    setInputToken(outputToken);
    setOutputToken(prev);
    setInputAmount("");
  }

  function fillAmount(pct: number) {
    if (inputBalance <= 0) return;
    const reserve = inputToken.symbol === "SOL" ? 0.01 : 0;
    const max = Math.max(0, inputBalance - reserve);
    const val = pct >= 1 ? max : parseFloat((max * pct).toFixed(inputToken.decimals));
    setInputAmount(val > 0 ? val.toString() : "");
  }

  async function handleSwap() {
    if (!quote) return;
    const sig = await execute(quote);
    if (sig) {
      setInputAmount("");
      setTimeout(() => reset(), 2000);
    }
  }

  // ── Devnet notice ────────────────────────────────────────────────────────
  if (CLUSTER !== "mainnet-beta") {
    return (
      <div className="card-glow rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-medium text-muted-foreground">
          Token Swap
        </h2>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Repeat2 className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Token swap uses Jupiter and requires mainnet.
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

  // ── Connect prompt ───────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="card-glow rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-medium text-muted-foreground">
          Token Swap
        </h2>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to swap tokens
          </p>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────
  const isSubmitting =
    status === "awaiting-approval" || status === "confirming";
  const hasValidInput = parseFloat(inputAmount) > 0;

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Token Swap</h2>
        <SlippageSettings value={slippageBps} onChange={setSlippageBps} />
      </div>

      <div className="space-y-2">
        {/* ── Input (You pay) ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">You pay</span>
            <span className="text-xs text-muted-foreground/60">
              Balance: {formatTokenAmount(inputBalance)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              disabled={isSubmitting}
              className="min-w-0 flex-1 bg-transparent font-mono text-xl text-foreground placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-50"
            />
            <TokenSelect
              tokens={SWAP_TOKENS}
              selected={inputToken}
              onChange={setInputToken}
              exclude={outputToken.mint}
              disabled={isSubmitting}
            />
          </div>

          {/* ── Amount fill buttons ──────────────────────────────────────── */}
          <div className="mt-3 flex gap-2">
            {FILL_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => fillAmount(opt.pct)}
                disabled={isSubmitting || inputBalance <= 0}
                className="flex-1 rounded-lg border border-border bg-background/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Flip button ───────────────────────────────────────────────── */}
        <div className="relative z-10 -my-4 flex justify-center">
          <button
            type="button"
            onClick={flipTokens}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Swap input and output tokens"
          >
            <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* ── Output (You receive) ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">You receive</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 font-mono text-xl text-foreground">
              {quoteLoading && hasValidInput ? (
                <Loader2
                  className="h-5 w-5 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : outputAmount ? (
                outputAmount
              ) : (
                <span className="text-muted-foreground/30">0</span>
              )}
            </div>
            <TokenSelect
              tokens={SWAP_TOKENS}
              selected={outputToken}
              onChange={setOutputToken}
              exclude={inputToken.mint}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* ── Quote details ─────────────────────────────────────────────────── */}
      {quote && hasValidInput && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-border/50 bg-background/20 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-mono text-foreground">
              1 {inputToken.symbol} ≈ {rate} {outputToken.symbol}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Price impact</span>
            <span
              className={`font-mono ${
                parseFloat(quote.priceImpactPct) > 1
                  ? "text-yellow-400"
                  : "text-foreground"
              }`}
            >
              {parseFloat(quote.priceImpactPct).toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Route</span>
            <span className="max-w-[200px] truncate text-foreground">
              {quote.routePlan.map((r) => r.swapInfo.label).join(" → ")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Slippage</span>
            <span className="text-foreground">{formatSlippage(slippageBps)}</span>
          </div>
        </div>
      )}

      {/* Quote error */}
      {quoteError && hasValidInput && !quoteLoading && (
        <p className="mt-3 text-center text-xs text-destructive">
          {quoteError instanceof Error
            ? quoteError.message
            : "No routes found"}
        </p>
      )}

      {/* ── Swap button ───────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSwap}
        disabled={!quote || isSubmitting || !hasValidInput}
        aria-busy={isSubmitting}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {status === "awaiting-approval"
              ? "Approve in wallet…"
              : "Confirming…"}
          </>
        ) : status === "confirmed" ? (
          "Swapped!"
        ) : status === "failed" ? (
          <>
            <Repeat2 className="h-4 w-4" aria-hidden />
            Try again
          </>
        ) : (
          <>
            <Repeat2 className="h-4 w-4" aria-hidden />
            Swap
          </>
        )}
      </button>

      {/* Attribution */}
      <p className="mt-3 text-center text-[10px] text-muted-foreground/40">
        Powered by Jupiter Aggregator
      </p>

      {/* Screen reader status */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === "awaiting-approval" && "Waiting for wallet approval"}
        {status === "confirming" && "Swap submitted, confirming"}
        {status === "confirmed" && "Swap confirmed"}
        {status === "failed" && "Swap failed"}
      </div>
    </div>
  );
}

// ─── Slippage settings popover ───────────────────────────────────────────────

function SlippageSettings({
  value,
  onChange,
}: {
  value: number;
  onChange: (bps: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState(
    SLIPPAGE_PRESETS_BPS.includes(value) ? "" : (value / 100).toString()
  );
  const isCustom = !SLIPPAGE_PRESETS_BPS.includes(value);

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setCustomInput(v);
    const num = parseFloat(v);
    if (!isNaN(num) && num > 0 && num <= 50) {
      onChange(Math.round(num * 100));
    }
  }

  function selectPreset(bps: number) {
    onChange(bps);
    setCustomInput("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Slippage settings"
        aria-expanded={open}
        className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Settings className="h-3 w-3" aria-hidden />
        <span className="font-mono tabular-nums">{formatSlippage(value)}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 text-xs font-medium text-foreground">Max slippage</p>
            <div className="mb-2 flex gap-1.5">
              {SLIPPAGE_PRESETS_BPS.map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => selectPreset(bps)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    !isCustom && value === bps
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {formatSlippage(bps)}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="50"
                placeholder="Custom"
                value={customInput}
                onChange={handleCustomChange}
                className={`w-full rounded-lg border bg-background/40 px-2.5 py-1.5 pr-7 font-mono text-xs tabular-nums text-foreground placeholder:font-sans placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                  isCustom ? "border-primary" : "border-border"
                }`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
            {value >= 500 && (
              <p className="mt-2 text-[10px] text-yellow-400">
                High slippage — trade may be front-run
              </p>
            )}
            {value < 10 && (
              <p className="mt-2 text-[10px] text-yellow-400">
                Low slippage — trade may fail
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Token selector with icon ────────────────────────────────────────────────

function TokenSelect({
  tokens,
  selected,
  onChange,
  exclude,
  disabled,
}: {
  tokens: SwapToken[];
  selected: SwapToken;
  onChange: (token: SwapToken) => void;
  exclude: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = tokens.filter((t) => t.mint !== exclude);

  return (
    <div className="relative shrink-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card pl-2 pr-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        <TokenIcon mint={selected.mint} size={22} />
        <span>{selected.symbol}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-xl">
            {options.map((token) => (
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
