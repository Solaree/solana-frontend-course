"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CLUSTER } from "@/lib/solana";

/**
 * Requests a devnet/testnet SOL airdrop via server-side API route.
 * The API route tries multiple RPC endpoints to bypass individual rate limits.
 * Hidden on mainnet.
 */
export function AirdropButton() {
  const { publicKey, connected } = useWallet();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [lastDrop, setLastDrop] = useState(0);

  if (CLUSTER === "mainnet-beta" || !connected || !publicKey) return null;

  async function handleAirdrop() {
    if (!publicKey || loading) return;

    // simple anti-spam (10s)
    if (Date.now() - lastDrop < 10000) {
      toast.error("Wait a few seconds before retrying");
      return;
    }

    const address = publicKey.toBase58();
    setLoading(true);
    setLastDrop(Date.now());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch("/api/airdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: controller.signal,
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (!res.ok) {
        // prefer structured errors
        if (data?.error === "RATE_LIMITED") {
          throw new Error("RATE_LIMITED");
        }
        throw new Error(data?.error || "Airdrop failed");
      }

      queryClient.invalidateQueries({
        queryKey: ["solBalance", address],
      });

      toast.success(
        `Airdrop successful — ${data?.amount ?? 1} SOL received!`
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        toast.error("Request timed out. Try again.");
        return;
      }

      const msg = err?.message || "";

      if (msg === "RATE_LIMITED") {
        toast.error(
          "All faucets rate-limited. Try again in a few minutes or use https://faucet.solana.com"
        );
      } else {
        toast.error(msg || "Airdrop failed");
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAirdrop}
      disabled={loading}
      aria-busy={loading}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Droplets className="h-4 w-4" aria-hidden />
      )}

      <span aria-live="polite">
        {loading ? "Airdropping…" : "Airdrop 1 SOL"}
      </span>
    </button>
  );
}
