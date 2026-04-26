"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Connection } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { decodeTransactionError, explorerTxUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";
import {
  JITOSOL_MINT,
  SOL_MINT,
  type JitoInfo,
  type StakingAction,
} from "@/lib/staking";
import type { JupiterQuote } from "@/lib/jupiter";

// ─── Status (mirrors LendingStatus / SwapStatus shapes) ──────────────────────

export type StakingStatus =
  | "idle"
  | "awaiting-approval"
  | "confirming"
  | "confirmed"
  | "failed";

// ─── Info hook ───────────────────────────────────────────────────────────────

/** Polls Jito's stake-pool stats — APY, exchange rate, TVL. */
export function useJitoInfo() {
  return useQuery<JitoInfo>({
    queryKey: ["jitoInfo"],
    queryFn: async () => {
      const res = await fetch("/api/staking/jito/info");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load Jito stake-pool info");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ─── Confirmation polling (shared shape with use-swap / use-lending) ─────────

async function pollSignatureStatus(
  connection: Connection,
  signature: string,
  timeoutMs = 60_000,
  intervalMs = 1_500
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
      // transient RPC failure — keep polling until the deadline
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return undefined;
}

// ─── Execution hook ──────────────────────────────────────────────────────────

/**
 * Stakes SOL → JitoSOL via the SPL stake pool, or unstakes JitoSOL → SOL
 * via Jupiter (for instant exit — direct stake-pool withdrawal is delayed
 * a full epoch).
 *
 * Same lifecycle as `useSwapExecution` and `useLendingExecution` so the
 * UI can branch on status without special-casing this protocol.
 */
export function useJitoStakingExecution() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StakingStatus>("idle");

  const execute = useCallback(
    async (
      action: StakingAction,
      /** Base units. For stake = SOL lamports; for unstake = JitoSOL base units. */
      amountBase: string
    ): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        toast.error("Connect your wallet first.");
        return null;
      }

      try {
        setStatus("awaiting-approval");

        // ── 1. Build the transaction ───────────────────────────────────────
        let serializedB64: string;

        if (action === "stake") {
          // Direct deposit_sol via the stake-pool program. Cheapest path
          // and gives the user actual JitoSOL minted at the protocol rate.
          const res = await fetch("/api/staking/jito/stake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amountBase,
              wallet: publicKey.toBase58(),
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Failed to build stake transaction");
          }
          const body = await res.json();
          serializedB64 = body.transaction;
        } else {
          // Unstake = swap JitoSOL → SOL via Jupiter. The SPL stake-pool
          // `withdrawStake` flow gives you a stake account that needs a
          // full epoch to unbond, which is a poor UX inside an instant-
          // looking form. Jupiter routes through whichever path is
          // cheapest at the moment (direct pool, OrcaWhirlpool, Sanctum,
          // etc.) and the user's SOL appears in the same tx.
          const quoteParams = new URLSearchParams({
            inputMint: JITOSOL_MINT,
            outputMint: SOL_MINT,
            amount: amountBase,
            slippageBps: "50",
          });
          const quoteRes = await fetch(
            `/api/swap/quote?${quoteParams.toString()}`
          );
          if (!quoteRes.ok) {
            const data = await quoteRes.json().catch(() => ({}));
            throw new Error(data.error ?? "No unstake route found");
          }
          const quote: JupiterQuote = await quoteRes.json();

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
            throw new Error(data.error ?? "Failed to build unstake transaction");
          }
          const body = await swapRes.json();
          serializedB64 = body.swapTransaction;
        }

        // ── 2. Deserialize + sign + send ────────────────────────────────────
        const bytes = Uint8Array.from(atob(serializedB64), (c) =>
          c.charCodeAt(0)
        );
        const tx = VersionedTransaction.deserialize(bytes);
        const signed = await signTransaction(tx);

        setStatus("confirming");

        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        // ── 3. Confirm — race websocket against polling (same pattern as
        //      use-swap and use-lending; see those hooks for rationale). ─
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        const confirmPromise = connection
          .confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            "confirmed"
          )
          .then((r) => r.value.err as unknown);

        const pollPromise = pollSignatureStatus(connection, sig, 60_000, 1500);

        let onChainErr: unknown | undefined;
        try {
          onChainErr = await Promise.race([confirmPromise, pollPromise]);
          if (onChainErr === undefined) {
            throw new Error(
              `${action === "stake" ? "Stake" : "Unstake"} submitted but never confirmed. Check the explorer.`
            );
          }
        } catch (e) {
          onChainErr = await pollPromise;
          if (onChainErr === undefined) throw e;
        }

        // ── 4. Refresh wallet state regardless of outcome ─────────────────
        const key = publicKey.toBase58();
        const refresh = () => {
          queryClient.invalidateQueries({ queryKey: ["solBalance", key] });
          queryClient.invalidateQueries({ queryKey: ["tokenAccounts", key] });
          queryClient.invalidateQueries({ queryKey: ["transactionHistory", key] });
          queryClient.invalidateQueries({ queryKey: ["jitoInfo"] });
        };
        refresh();
        setTimeout(refresh, 1_800);

        if (onChainErr) {
          setStatus("failed");
          toast.error(
            `${action === "stake" ? "Stake" : "Unstake"} landed but failed on-chain.`,
            {
              action: {
                label: "View",
                onClick: () =>
                  window.open(explorerTxUrl(sig, CLUSTER), "_blank", "noreferrer"),
              },
            }
          );
          return null;
        }

        setStatus("confirmed");
        return sig;
      } catch (err) {
        console.error(`[staking/jito/${action}] execution error:`, err);
        const message = decodeTransactionError(err);
        if (!message) {
          // Genuine user rejection — silently reset.
          setStatus("idle");
          return null;
        }
        setStatus("failed");
        toast.error(message, { duration: 8_000 });
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
