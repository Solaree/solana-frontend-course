"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Connection } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { decodeTransactionError, explorerTxUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";
import { type JupiterQuote } from "@/lib/jupiter";

/**
 * Polls signature status directly. Used as a fallback when
 * `confirmTransaction` throws (e.g. blockhash expired, websocket
 * dropped) — the tx itself may still have landed on-chain.
 *
 * Returns the on-chain error (null = success) once the tx reaches
 * `confirmed`, or `undefined` if we never saw it after `timeoutMs`.
 */
async function pollSignatureStatus(
  connection: Connection,
  signature: string,
  timeoutMs = 20_000,
  intervalMs = 1500
): Promise<unknown | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = value[0];
      if (
        status &&
        (status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized")
      ) {
        return status.err;
      }
    } catch {
      // Swallow transient RPC errors and keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return undefined;
}

// ─── Quote hook ──────────────────────────────────────────────────────────────

/**
 * Fetches a swap quote via our server-side Jupiter proxy (/api/swap/quote).
 * Automatically refetches every 15 s while the query is active.
 */
export function useSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
) {
  return useQuery({
    queryKey: ["jupiterQuote", inputMint, outputMint, amount, slippageBps],
    queryFn: async (): Promise<JupiterQuote> => {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
      });

      const res = await fetch(`/api/swap/quote?${params}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No routes found for this pair");
      }

      return res.json();
    },
    enabled: !!inputMint && !!outputMint && !!amount && amount !== "0",
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  });
}

// ─── Execution hook ──────────────────────────────────────────────────────────

export type SwapStatus =
  | "idle"
  | "awaiting-approval"
  | "confirming"
  | "confirmed"
  | "failed";

/**
 * Executes a Jupiter swap: build versioned tx → sign → send → confirm.
 */
export function useSwapExecution() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SwapStatus>("idle");

  const execute = useCallback(
    async (quote: JupiterQuote): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        toast.error("Connect your wallet first.");
        return null;
      }

      try {
        setStatus("awaiting-approval");

        // 1. Get serialized swap transaction via server-side proxy
        const swapRes = await fetch("/api/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: publicKey.toBase58(),
          }),
        });

        if (!swapRes.ok) {
          const data = await swapRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to build swap transaction");
        }

        const { swapTransaction } = await swapRes.json();

        // 2. Deserialize versioned transaction (base64 → Uint8Array)
        const bytes = Uint8Array.from(atob(swapTransaction), (c) =>
          c.charCodeAt(0)
        );
        const tx = VersionedTransaction.deserialize(bytes);

        // 3. Sign with wallet
        const signed = await signTransaction(tx);
        setStatus("confirming");

        // 4. Send
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        // 5. Confirm — first via the normal blockhash-based path, then
        //    fall back to polling signature status if that throws
        //    (e.g. blockhash expired, websocket dropped). The tx may
        //    already be on-chain even when confirmTransaction rejects.
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        let onChainErr: unknown | undefined;
        try {
          const result = await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          onChainErr = result.value.err;
        } catch {
          onChainErr = await pollSignatureStatus(connection, sig);
          if (onChainErr === undefined) {
            // Tx never showed up — genuine failure.
            throw new Error(
              "Swap submitted but never confirmed. Check the explorer."
            );
          }
        }

        // Refresh balances, token accounts, and history even on on-chain
        // failure — the fee was still spent and the UI should reflect the
        // current wallet state.
        const key = publicKey.toBase58();
        const refreshWalletState = () => {
          queryClient.invalidateQueries({ queryKey: ["solBalance", key] });
          queryClient.invalidateQueries({ queryKey: ["tokenAccounts", key] });
          queryClient.invalidateQueries({
            queryKey: ["transactionHistory", key],
          });
        };
        refreshWalletState();
        setTimeout(refreshWalletState, 1800);

        if (onChainErr) {
          setStatus("failed");
          toast.error("Swap landed but failed on-chain.", {
            action: {
              label: "View",
              onClick: () =>
                window.open(
                  explorerTxUrl(sig, CLUSTER),
                  "_blank",
                  "noreferrer"
                ),
            },
          });
          return null;
        }

        setStatus("confirmed");

        toast.success("Swap confirmed!", {
          action: {
            label: "View on Explorer",
            onClick: () =>
              window.open(
                explorerTxUrl(sig, CLUSTER),
                "_blank",
                "noreferrer"
              ),
          },
        });

        return sig;
      } catch (err) {
        const message = decodeTransactionError(err);

        // Empty message = user cancelled — not an error
        if (!message) {
          setStatus("idle");
          return null;
        }

        setStatus("failed");
        toast.error(message, { duration: 8000 });
        return null;
      }
    },
    [publicKey, signTransaction, connection, queryClient]
  );

  const reset = useCallback(() => setStatus("idle"), []);

  return {
    execute,
    status,
    reset,
    isLoading: status === "awaiting-approval" || status === "confirming",
  };
}
