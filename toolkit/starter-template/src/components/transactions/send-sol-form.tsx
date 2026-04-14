"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send, Wallet, Zap } from "lucide-react";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { useSolBalance } from "@/hooks/use-sol-balance";

const schema = z.object({
  recipient: z.string().refine(
    (val) => { try { new PublicKey(val); return true; } catch { return false; } },
    { message: "Enter a valid Solana address" }
  ),
  amount: z
    .coerce.number({ invalid_type_error: "Enter a number" })
    .positive("Must be greater than 0")
    .max(1000, "Max 1000 SOL"),
  fast: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_LABELS = {
  idle: "Send SOL",
  "awaiting-approval": "Approve in wallet…",
  confirming: "Confirming…",
  confirmed: "Sent!",
  failed: "Try again",
} as const;

export function SendSolForm() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { data: balance } = useSolBalance();
  const { send, status, reset } = useSendTransaction();
  const [simResult, setSimResult] = useState<{ success: boolean; units: number } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset: resetForm,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { fast: false } });

  const isFast = watch("fast");
  const isSubmitting = status === "awaiting-approval" || status === "confirming";

  async function buildTx(values: FormValues): Promise<Transaction | null> {
    if (!publicKey) return null;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: publicKey });
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 3_000 }));
    if (values.fast) tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
    tx.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(values.recipient),
        lamports: Math.round(values.amount * LAMPORTS_PER_SOL),
      })
    );
    return tx;
  }

  async function handlePreview(values: FormValues) {
    const tx = await buildTx(values);
    if (!tx || !publicKey) return;
    tx.feePayer = publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const result = await connection.simulateTransaction(tx);
    setSimResult({ success: !result.value.err, units: result.value.unitsConsumed ?? 0 });
  }

  async function onSubmit(values: FormValues) {
    const tx = await buildTx(values);
    if (!tx) return;
    const sig = await send(tx);
    if (sig) { resetForm(); setSimResult(null); reset(); }
  }

  function setMax() {
    if (balance === undefined) return;
    setValue("amount", parseFloat(Math.max(0, balance - 0.001).toFixed(6)));
  }

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-5 text-sm font-medium text-muted-foreground">Send SOL</h2>

      {!connected ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to send SOL
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <label htmlFor="recipient" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recipient
            </label>
            <input
              id="recipient"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Solana address"
              disabled={isSubmitting}
              aria-invalid={!!errors.recipient}
              aria-describedby={errors.recipient ? "recipient-error" : undefined}
              className="h-11 w-full rounded-xl border border-border bg-background px-4 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground/50 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              {...register("recipient")}
            />
            {errors.recipient && (
              <p id="recipient-error" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                <span aria-hidden>·</span>
                {errors.recipient.message}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="amount" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Amount
              </label>
              {balance !== undefined && (
                <button
                  type="button"
                  onClick={setMax}
                  className="text-xs text-primary/80 transition-colors hover:text-primary focus-visible:outline-none"
                >
                  Max {balance.toFixed(4)} SOL
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="amount"
                type="number"
                step="0.0001"
                min="0"
                autoComplete="off"
                placeholder="0.0000"
                disabled={isSubmitting}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 pr-14 font-mono tabular-nums text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground/50 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                {...register("amount")}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                SOL
              </span>
            </div>
            {errors.amount && (
              <p id="amount-error" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                <span aria-hidden>·</span>
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Priority fee toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3 transition-colors hover:bg-accent/40">
            <span className="flex items-center gap-2 text-sm">
              <Zap
                className={`h-4 w-4 transition-colors ${isFast ? "text-yellow-400" : "text-muted-foreground"}`}
                aria-hidden
              />
              <span className={isFast ? "text-foreground" : "text-muted-foreground"}>
                Fast mode
              </span>
              <span className="text-xs text-muted-foreground/60">(+priority fee)</span>
            </span>
            <div className={`relative h-5 w-9 rounded-full transition-colors ${isFast ? "bg-primary" : "bg-muted"}`}>
              <input type="checkbox" className="sr-only" {...register("fast")} />
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isFast ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </label>

          {/* Simulation result */}
          {simResult && (
            <div
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                simResult.success
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                  : "border-destructive/20 bg-destructive/5 text-destructive"
              }`}
              role="status"
            >
              {simResult.success
                ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                : <span className="h-4 w-4 shrink-0 text-center font-bold" aria-hidden>!</span>}
              <span className="text-xs">
                {simResult.success
                  ? `Preview OK — ~${simResult.units.toLocaleString()} compute units`
                  : "Simulation failed — check the address and your balance"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSubmit(handlePreview)}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              Preview
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                : <Send className="h-4 w-4" aria-hidden />}
              {STATUS_LABELS[status] ?? "Send SOL"}
            </button>
          </div>
        </form>
      )}

      {/* Screen reader tx status */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "awaiting-approval" && "Waiting for wallet approval"}
        {status === "confirming" && "Transaction submitted, confirming"}
        {status === "confirmed" && "Transaction confirmed"}
        {status === "failed" && "Transaction failed"}
      </div>
    </div>
  );
}
