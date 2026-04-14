import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicKey } from "@solana/web3.js";

interface WalletStore {
  // Runtime state — synced from wallet adapter, never persisted
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  walletName: string | null;

  // User preferences — persisted to localStorage
  slippageBps: number;

  // Internal: called by WalletSync to push adapter state into the store
  syncFromAdapter: (state: {
    publicKey: PublicKey | null;
    connected: boolean;
    connecting: boolean;
    walletName: string | null;
  }) => void;

  setSlippageBps: (bps: number) => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      publicKey: null,
      connected: false,
      connecting: false,
      walletName: null,
      slippageBps: 50, // 0.5 % default

      syncFromAdapter: (state) => set(state),
      setSlippageBps: (bps) => set({ slippageBps: bps }),
    }),
    {
      name: "wallet-preferences",
      // Only persist user preferences — runtime state is always re-derived
      // from the wallet adapter on mount.
      partialize: (state) => ({ slippageBps: state.slippageBps }),
    }
  )
);
