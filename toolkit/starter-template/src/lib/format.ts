import { PublicKey } from "@solana/web3.js";

// ─── Address formatting ───────────────────────────────────────────────────────

/**
 * Truncates a Solana address to First{chars}...Last{chars}.
 * Default: "7xKX...p2aB"
 */
export function truncateAddress(
  address: string | PublicKey,
  chars = 4
): string {
  const str = typeof address === "string" ? address : address.toBase58();
  if (str.length <= chars * 2 + 3) return str;
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

/**
 * Validates and returns a PublicKey, or null if invalid.
 */
export function parsePublicKey(address: string): PublicKey | null {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
}

// ─── Token amount formatting ──────────────────────────────────────────────────

/**
 * Formats a token amount for display, adapting precision to value size.
 * - Large (≥1M):  "1.23M"
 * - Medium (≥1K): "12.3K"
 * - Normal (≥1):  "12.3456"
 * - Small (<1):   up to 6 significant figures
 */
export function formatTokenAmount(amount: number, maxDecimals = 4): string {
  if (!isFinite(amount) || isNaN(amount)) return "0";

  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  if (amount >= 1) {
    // Trim trailing zeros, keep up to maxDecimals
    return parseFloat(amount.toFixed(maxDecimals)).toString();
  }
  if (amount > 0) {
    // Small amounts: up to 6 sig figs, trim trailing zeros
    return parseFloat(amount.toPrecision(6)).toString();
  }
  return "0";
}

/**
 * Formats a USD value: "$1,234.56" or "$0.0012"
 */
export function formatUsd(value: number): string {
  if (value >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  // Sub-dollar amounts show more precision
  return `$${value.toPrecision(3)}`;
}

// ─── Timestamp formatting ─────────────────────────────────────────────────────

/**
 * Returns a relative time string: "just now", "3m ago", "2h ago", "Apr 12"
 */
export function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(unixSeconds * 1000));
}

// ─── Explorer links ───────────────────────────────────────────────────────────

type Cluster = "mainnet-beta" | "devnet" | "testnet";

export function explorerAddressUrl(
  address: string,
  cluster: Cluster = "devnet"
): string {
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${clusterParam}`;
}

export function explorerTxUrl(
  signature: string,
  cluster: Cluster = "devnet"
): string {
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

// ─── Transaction error decoding ───────────────────────────────────────────────

/**
 * Converts a raw transaction error into a user-facing message.
 * Returns empty string for user rejections (not an error).
 */
export function decodeTransactionError(err: unknown): string {
  if (!(err instanceof Error)) return "An unknown error occurred.";

  // User cancelled — not an error
  if (
    err.name === "WalletSignTransactionError" ||
    err.message.toLowerCase().includes("user rejected")
  ) {
    return "";
  }

  if (err.message.includes("Blockhash not found")) {
    return "The transaction took too long. Please try again.";
  }
  if (err.message.includes("insufficient funds for rent")) {
    return "Your account needs a minimum SOL balance to remain active (rent exemption).";
  }
  if (err.message.includes("insufficient funds")) {
    return "Not enough SOL to cover this transaction and its fee.";
  }
  // Solana's "no record of a prior credit" actually means the wallet's SOL
  // balance can't cover what the transaction is debiting — usually deposit
  // amount + ATA rent + first-time PDA rents. Logs come back empty because
  // it dies at the first ix.
  if (err.message.includes("no record of a prior credit")) {
    return "Not enough SOL — this transaction needs the deposit amount plus ~0.025 SOL for account rent and fees.";
  }
  // Kamino's first-time deposit creates a Farms `UserState` PDA mid-tx
  // (after the deposit amount has already been moved to wSOL), so the
  // wallet runs dry on rent for the farm account specifically. Surface
  // it as a clear "leave more SOL" hint rather than the raw lamport error.
  if (
    err.message.includes("Transfer: insufficient lamports") ||
    (err.message.includes("InitObligationFarmsForReserve") &&
      err.message.includes("custom program error: 0x1"))
  ) {
    return "Not enough SOL left after the deposit. Kamino's first-time setup needs ~0.06 SOL free for account rent — try a smaller amount or use the Max button after switching protocols.";
  }
  if (err.message.includes("SlippageToleranceExceeded")) {
    return "Price moved too much. Try raising your slippage tolerance and retry.";
  }
  if (err.message.includes("Transaction simulation failed")) {
    return "Transaction simulation failed — the program rejected this action.";
  }

  return err.message;
}
