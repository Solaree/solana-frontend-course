"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { decodeTransactionError, explorerTxUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";

export type TxStatus =
  | "idle"
  | "awaiting-approval"
  | "confirming"
  | "confirmed"
  | "failed";

interface UseSendTransactionReturn {
  send: (tx: Transaction) => Promise<string | null>;
  status: TxStatus;
  signature: string | null;
  reset: () => void;
  isLoading: boolean;
}

/**
 * Manages the full lifecycle of a Solana transaction:
 * awaiting wallet approval → submitting → confirming → confirmed/failed.
 *
 * Automatically invalidates balance queries on success.
 */
export function useSendTransaction(): UseSendTransactionReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<TxStatus>("idle");
  const [signature, setSignature] = useState<string | null>(null);

  const send = useCallback(
    async (tx: Transaction): Promise<string | null> => {
      if (!publicKey) {
        toast.error("Connect your wallet first.");
        return null;
      }

      try {
        setStatus("awaiting-approval");

        const sig = await sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        setSignature(sig);
        setStatus("confirming");

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");

        const result = await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        if (result.value.err) {
          setStatus("failed");
          toast.error("Transaction landed but failed on-chain. Check the explorer for logs.", {
            action: {
              label: "View",
              onClick: () =>
                window.open(explorerTxUrl(sig, CLUSTER), "_blank", "noreferrer"),
            },
          });
          return null;
        }

        setStatus("confirmed");

        // Invalidate balance caches so they refetch fresh data
        queryClient.invalidateQueries({
          queryKey: ["solBalance", publicKey.toBase58()],
        });
        queryClient.invalidateQueries({
          queryKey: ["tokenAccounts", publicKey.toBase58()],
        });

        toast.success("Transaction confirmed", {
          action: {
            label: "View on Explorer",
            onClick: () =>
              window.open(explorerTxUrl(sig, CLUSTER), "_blank", "noreferrer"),
          },
        });

        return sig;
      } catch (err) {
        const message = decodeTransactionError(err);

        // Empty message = user rejection — return silently
        if (!message) {
          setStatus("idle");
          return null;
        }

        setStatus("failed");
        toast.error(message, { duration: 8000 });
        return null;
      }
    },
    [publicKey, connection, sendTransaction, queryClient]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setSignature(null);
  }, []);

  const isLoading =
    status === "awaiting-approval" || status === "confirming";

  return { send, status, signature, reset, isLoading };
}
