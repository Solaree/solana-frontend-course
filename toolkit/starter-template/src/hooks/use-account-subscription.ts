"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import type { AccountInfo, Context, PublicKey } from "@solana/web3.js";
import { useEffect, useRef } from "react";

/**
 * Subscribes to on-chain account changes via WebSocket.
 * Automatically unsubscribes on unmount or when publicKey changes.
 *
 * @param publicKey - Account to watch. Pass null to skip subscription.
 * @param onUpdate  - Called whenever the account data changes on-chain.
 */
export function useAccountSubscription(
  publicKey: PublicKey | null,
  onUpdate: (info: AccountInfo<Buffer>, context: Context) => void
): void {
  const { connection } = useConnection();
  const subIdRef = useRef<number | null>(null);
  // Stable ref for the callback so we don't re-subscribe on every render
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!publicKey) return;

    subIdRef.current = connection.onAccountChange(
      publicKey,
      (info, context) => callbackRef.current(info, context),
      "confirmed"
    );

    return () => {
      if (subIdRef.current !== null) {
        connection.removeAccountChangeListener(subIdRef.current);
        subIdRef.current = null;
      }
    };
  // publicKey.toBase58() is stable; publicKey object reference changes on each connect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey?.toBase58(), connection]);
}
