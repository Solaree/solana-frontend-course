"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletStore } from "@/store/wallet";

/**
 * Invisible component that keeps the Zustand wallet store in sync with
 * @solana/wallet-adapter-react. Must be rendered inside WalletProvider.
 */
export function WalletSync() {
  const { publicKey, connected, connecting, wallet } = useWallet();
  const syncFromAdapter = useWalletStore((s) => s.syncFromAdapter);

  useEffect(() => {
    syncFromAdapter({
      publicKey: publicKey ?? null,
      connected,
      connecting,
      walletName: wallet?.adapter.name ?? null,
    });
  }, [publicKey, connected, connecting, wallet, syncFromAdapter]);

  return null;
}
