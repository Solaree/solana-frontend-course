"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, type Connection } from "@solana/web3.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { decodeTransactionError, explorerTxUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";
import { type LendingReserve } from "@/lib/lending";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LendingProtocol = "kamino" | "save";
export type LendingAction = "deposit" | "withdraw";
export type LendingStatus =
  | "idle"
  | "awaiting-approval"
  | "confirming"
  | "confirmed"
  | "failed";

// ─── Market data hooks ────────────────────────────────────────────────────────

/** Polls Kamino's main market reserves (APY, TVL, utilisation). */
export function useKaminoMarkets() {
  return useQuery<LendingReserve[]>({
    queryKey: ["kaminoMarkets"],
    queryFn: async () => {
      const res = await fetch("/api/lending/kamino/markets");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load Kamino markets");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

/**
 * Reads the wallet's deposited amount (human units) for a given mint on the
 * specified protocol. Returns 0 when there's no obligation or no deposit
 * in that reserve.
 *
 * Refreshed alongside the broader wallet state — invalidate
 * `["lendingPosition", protocol, wallet]` after a confirmed deposit/withdraw
 * to push fresh numbers into the form.
 */
export function useLendingPosition(
  protocol: LendingProtocol,
  mint: string,
  wallet: string | null
) {
  return useQuery({
    queryKey: ["lendingPosition", protocol, wallet, mint],
    queryFn: async (): Promise<number> => {
      if (!wallet) return 0;
      const params = new URLSearchParams({ wallet, mint });
      const res = await fetch(
        `/api/lending/${protocol}/position?${params.toString()}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to load ${protocol} position`
        );
      }
      const body: { deposited: number } = await res.json();
      return body.deposited ?? 0;
    },
    enabled: !!wallet && !!mint,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** Polls Save Finance's main pool reserves (APY, TVL, utilisation). */
export function useSaveMarkets() {
  return useQuery<LendingReserve[]>({
    queryKey: ["saveMarkets"],
    queryFn: async () => {
      const res = await fetch("/api/lending/save/markets");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load Save Finance markets");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pollSignatureStatus(
  connection: Connection,
  signature: string,
  timeoutMs = 20_000,
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
      // transient RPC error — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return undefined;
}

// ─── Execution hook ───────────────────────────────────────────────────────────

/**
 * Executes a lending action (deposit or withdraw) on Kamino or Save Finance.
 *
 * Flow: build tx via API route → sign with wallet → send → confirm
 * Exactly mirrors useSwapExecution from use-swap.ts.
 */
export function useLendingExecution(protocol: LendingProtocol) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LendingStatus>("idle");

  const execute = useCallback(
    async (
      action: LendingAction,
      mint: string,
      amountBase: string // amount in base units (e.g. "1000000" for 1 USDC)
    ): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        toast.error("Connect your wallet first.");
        return null;
      }

      try {
        setStatus("awaiting-approval");

        // 1. Build transaction server-side
        const endpoint = `/api/lending/${protocol}/${action}`;
        const buildRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mint,
            amount: amountBase,
            wallet: publicKey.toBase58(),
          }),
        });

        if (!buildRes.ok) {
          const data = await buildRes.json().catch(() => ({}));
          throw new Error(
            data.error ?? `Failed to build ${protocol} ${action} transaction`
          );
        }

        const { transaction } = await buildRes.json();

        // 2. Deserialize versioned transaction
        const bytes = Uint8Array.from(atob(transaction), (c) =>
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

        // 5. Confirm — race websocket-based confirmation against REST polling.
        //    On public/flaky RPCs `signatureSubscribe` often never fires the
        //    "confirmed" push even after the tx lands. Without polling as a
        //    backstop, the call sits forever and the UI hangs on
        //    "Confirming…" while balances have already updated.
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
            // Poll deadline lapsed and the websocket never resolved.
            throw new Error(
              "Transaction submitted but never confirmed. Check the explorer."
            );
          }
        } catch (e) {
          onChainErr = await pollPromise;
          if (onChainErr === undefined) throw e;
        }

        // Refresh wallet state regardless of on-chain outcome
        const key = publicKey.toBase58();
        const refresh = () => {
          queryClient.invalidateQueries({ queryKey: ["solBalance", key] });
          queryClient.invalidateQueries({ queryKey: ["tokenAccounts", key] });
          queryClient.invalidateQueries({ queryKey: ["transactionHistory", key] });
          // Push fresh deposit numbers into the form so the withdraw "Max"
          // updates immediately after a successful deposit/withdraw.
          queryClient.invalidateQueries({ queryKey: ["lendingPosition", protocol, key] });
        };
        refresh();
        setTimeout(refresh, 1_800);

        if (onChainErr) {
          setStatus("failed");
          toast.error("Transaction landed but failed on-chain.", {
            action: {
              label: "View",
              onClick: () =>
                window.open(explorerTxUrl(sig, CLUSTER), "_blank", "noreferrer"),
            },
          });
          return null;
        }

        setStatus("confirmed");
        // Success is announced by the balance top-up notifier on withdraw
        // (when SOL/USDC re-appears in the wallet) and by the form's
        // own "Deposited!" button state on deposit. Suppressing a third
        // toast keeps the bottom-right corner uncluttered.
        return sig;
      } catch (err) {
        // Log everything — wallet hangs and silent simulation failures are
        // hard to debug otherwise, especially for protocol-built txns.
        console.error(`[lending/${protocol}] execution error:`, err);
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
    [publicKey, signTransaction, connection, queryClient, protocol]
  );

  const reset = useCallback(() => setStatus("idle"), []);

  return {
    execute,
    status,
    reset,
    isLoading: status === "awaiting-approval" || status === "confirming",
  };
}
