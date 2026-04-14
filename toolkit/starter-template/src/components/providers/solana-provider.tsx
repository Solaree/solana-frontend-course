"use client";

import { useMemo, useEffect } from "react";
import { SWAP_TOKENS, preloadTokenIcons } from "@/lib/jupiter";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { RPC_ENDPOINT } from "@/lib/solana";
import { WalletSync } from "./wallet-sync";

// Default wallet adapter styles — override in globals.css
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: React.ReactNode;
}

export function SolanaProvider({ children }: Props) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    // Wallets array must be stable — empty deps array is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    preloadTokenIcons(SWAP_TOKENS.map((t) => t.mint));
  }, []);

  return (
    <ConnectionProvider
      endpoint={RPC_ENDPOINT}
      config={{
        commitment: "confirmed",
        wsEndpoint: "wss://api.devnet.solana.com",
      }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletSync />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
