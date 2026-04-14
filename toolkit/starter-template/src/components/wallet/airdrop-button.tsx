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

  if (CLUSTER === "mainnet-beta" || !connected || !publicKey) return null;

  async function handleAirdrop() {
    if (!publicKey || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/airdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: publicKey.toBase58() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Airdrop failed");
      }

      queryClient.invalidateQueries({
        queryKey: ["solBalance", publicKey.toBase58()],
      });

      toast.success("Airdrop successful — 1 SOL received!");
    } catch (err: any) {
      const msg = err?.message || "";

      if (msg.includes("rate") || msg.includes("429") || msg.includes("faucet")) {
        toast.error("All faucets rate-limited. Try again in a few minutes or use Faucet (https://faucet.solana.com)");
      } else {
        toast.error(msg || "Airdrop failed");
      }
    } finally {
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
      {loading ? "Airdropping…" : "Airdrop 1 SOL"}
    </button>
  );
}
