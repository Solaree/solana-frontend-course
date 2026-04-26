"use client";

import { toast } from "sonner";
import { TokenIcon } from "@/components/ui/token-icon";
import { formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BalanceToastKind = "received" | "deposited" | "withdrawn";

export interface BalanceToastOptions {
  kind: BalanceToastKind;
  symbol: string;
  mint: string;
  /** Always positive — sign is added by the toast based on `kind`. */
  amount: number;
  /** New wallet balance for "received". For deposited/withdrawn, you can
   *  pass the new wallet balance OR omit it and pass `subtitle` directly. */
  newBalance?: number;
  /** Optional context label shown next to the kind ("Kamino", "Save"). */
  protocolLabel?: string;
  /** Override the default subtitle line. */
  subtitle?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const KIND_CONFIG: Record<
  BalanceToastKind,
  { label: string; sign: string; accent: string; amountTone: string }
> = {
  // Incoming → emerald accent, positive sign, full-strength amount.
  received: {
    label: "Received",
    sign: "+",
    accent: "bg-emerald-500/80",
    amountTone: "text-foreground",
  },
  // Deposited into a protocol → primary accent (matches the form's button),
  // negative sign because the wallet balance dropped.
  deposited: {
    label: "Deposited",
    sign: "−",
    accent: "bg-primary/80",
    amountTone: "text-foreground/90",
  },
  // Withdrawn from the wallet (e.g. JitoSOL leaving the wallet during a
  // Jito unstake swap). Soft amber accent so it reads as "neutral exit"
  // rather than the primary-coloured "deposited into a protocol" toast.
  // Negative sign mirrors `deposited` since the wallet balance dropped.
  withdrawn: {
    label: "Withdrawn",
    sign: "−",
    accent: "bg-amber-500/80",
    amountTone: "text-foreground/90",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Single visual surface for every balance-change notification. The design is
 * intentionally restrained — a thin left accent bar carries the colour signal
 * (so the rest of the toast matches the page's neutral card aesthetic), the
 * uppercase label + protocol context lives in muted text above the amount,
 * and the amount itself uses tabular-num mono so digit columns line up
 * regardless of value size.
 */
function BalanceToastBody({
  toastId,
  ...opts
}: BalanceToastOptions & { toastId: string | number }) {
  const cfg = KIND_CONFIG[opts.kind];
  const { symbol, mint, amount, newBalance, protocolLabel, subtitle } = opts;

  // Default subtitle per kind. Callers can override via `subtitle`.
  const computedSubtitle =
    subtitle ??
    (newBalance != null
      ? `Balance ${formatTokenAmount(newBalance)} ${symbol}`
      : undefined);

  return (
    <div
      onClick={() => toast.dismiss(toastId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") toast.dismiss(toastId);
      }}
      // Card surface mirrors the lending form (border-border + bg-card),
      // but with a sharper corner (`rounded-lg`) and a real shadow rather
      // than the page's `card-glow` accent — the glow looks great on a
      // standalone card but reads as visual noise on a transient toast.
      className="group flex w-[380px] cursor-pointer items-stretch overflow-hidden rounded-lg border border-border bg-card shadow-lg shadow-black/30 transition-colors hover:border-border/80 focus:outline-none focus:ring-1 focus:ring-ring/50"
    >
      {/* Direction accent bar — narrow on purpose so the colour reads as a
          tag, not a chrome. Same visual language as Linear / Stripe row
          status indicators. */}
      <div className={cn("w-[3px] shrink-0", cfg.accent)} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
        <TokenIcon mint={mint} size={38} />

        <div className="min-w-0 flex-1">
          {/* Eyebrow row: kind + optional protocol context. Uses uppercase
              tracking so it reads as metadata, not as content. */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground">
            <span>{cfg.label}</span>
            {protocolLabel && (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span>{protocolLabel}</span>
              </>
            )}
          </div>

          {/* Amount line — the visual anchor of the toast. Sign-aware so
              outgoing flows (deposited) read as negative without the eye
              having to parse the eyebrow. */}
          <div className="mt-1.5 flex items-baseline gap-1.5 truncate">
            <span
              className={cn(
                "font-mono text-[15px] font-semibold leading-none tabular-nums",
                cfg.amountTone
              )}
            >
              {cfg.sign}
              {formatTokenAmount(amount)}
            </span>
            <span className="text-[13px] font-medium leading-none text-muted-foreground">
              {symbol}
            </span>
          </div>

          {/* Subtitle row — current balance, or a contextual message
              passed by the caller. Smaller and muted so it doesn't compete
              with the amount. */}
          {computedSubtitle && (
            <div className="mt-1.5 truncate text-[11px] leading-none text-muted-foreground/80 tabular-nums">
              {computedSubtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Fires a balance-change toast. Safe to call from any client component. */
export function showBalanceToast(opts: BalanceToastOptions): void {
  toast.custom(
    (id) => <BalanceToastBody {...opts} toastId={id} />,
    { duration: 5000 }
  );
}
