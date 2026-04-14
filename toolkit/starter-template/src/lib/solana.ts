import { clusterApiUrl } from "@solana/web3.js";

export type SolanaCluster = "devnet" | "mainnet-beta" | "testnet";

export const CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_CLUSTER as SolanaCluster) ?? "devnet";

export const RPC_ENDPOINT: string =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : clusterApiUrl(CLUSTER);
