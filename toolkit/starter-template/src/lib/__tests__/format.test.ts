import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  truncateAddress,
  parsePublicKey,
  formatTokenAmount,
  formatUsd,
  formatRelativeTime,
  explorerAddressUrl,
  explorerTxUrl,
  decodeTransactionError,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------
describe("truncateAddress", () => {
  const addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83FkBRTSvpA2B";

  test("truncates to First4...Last4 by default", () => {
    expect(truncateAddress(addr)).toBe("7xKX...pA2B");
  });

  test("accepts a custom char count", () => {
    expect(truncateAddress(addr, 6)).toBe("7xKXtg...SvpA2B");
  });

  test("returns short strings unchanged", () => {
    expect(truncateAddress("abc")).toBe("abc");
  });

  test("accepts a PublicKey instance", () => {
    const pk = new PublicKey(addr);
    const result = truncateAddress(pk);
    expect(result).toBe(truncateAddress(addr));
  });
});

// ---------------------------------------------------------------------------
// parsePublicKey
// ---------------------------------------------------------------------------
describe("parsePublicKey", () => {
  test("returns a PublicKey for a valid address", () => {
    const pk = parsePublicKey("11111111111111111111111111111111");
    expect(pk).toBeInstanceOf(PublicKey);
  });

  test("returns null for an invalid address", () => {
    expect(parsePublicKey("not-a-valid-key")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatTokenAmount
// ---------------------------------------------------------------------------
describe("formatTokenAmount", () => {
  test("formats millions with M suffix", () => {
    expect(formatTokenAmount(1_500_000)).toBe("1.50M");
    expect(formatTokenAmount(42_000_000)).toBe("42.00M");
  });

  test("formats thousands with K suffix", () => {
    expect(formatTokenAmount(12_345)).toBe("12.35K");
    expect(formatTokenAmount(1_000)).toBe("1.00K");
  });

  test("formats normal amounts with trimmed decimals", () => {
    expect(formatTokenAmount(12.3456)).toBe("12.3456");
    expect(formatTokenAmount(5.1)).toBe("5.1");
  });

  test("formats small amounts with significant figures", () => {
    expect(formatTokenAmount(0.001234)).toBe("0.001234");
  });

  test("returns '0' for zero, NaN, and Infinity", () => {
    expect(formatTokenAmount(0)).toBe("0");
    expect(formatTokenAmount(NaN)).toBe("0");
    expect(formatTokenAmount(Infinity)).toBe("0");
    expect(formatTokenAmount(-Infinity)).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// formatUsd
// ---------------------------------------------------------------------------
describe("formatUsd", () => {
  test("formats values >= $1 as currency", () => {
    expect(formatUsd(1234.56)).toBe("$1,234.56");
    expect(formatUsd(1)).toBe("$1.00");
  });

  test("formats sub-dollar values with precision", () => {
    const result = formatUsd(0.00567);
    expect(result).toMatch(/^\$0\.00567$/);
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe("formatRelativeTime", () => {
  const now = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns 'just now' for < 60s ago", () => {
    expect(formatRelativeTime(now() - 30)).toBe("just now");
  });

  test("returns minutes ago", () => {
    expect(formatRelativeTime(now() - 180)).toBe("3m ago");
  });

  test("returns hours ago", () => {
    expect(formatRelativeTime(now() - 7200)).toBe("2h ago");
  });

  test("returns date for > 24h ago", () => {
    expect(formatRelativeTime(now() - 172_800)).toMatch(/Apr 16/);
  });
});

// ---------------------------------------------------------------------------
// explorerAddressUrl / explorerTxUrl
// ---------------------------------------------------------------------------
describe("explorer URLs", () => {
  test("devnet address URL includes cluster param", () => {
    const url = explorerAddressUrl("abc123", "devnet");
    expect(url).toBe("https://explorer.solana.com/address/abc123?cluster=devnet");
  });

  test("mainnet address URL omits cluster param", () => {
    const url = explorerAddressUrl("abc123", "mainnet-beta");
    expect(url).toBe("https://explorer.solana.com/address/abc123");
  });

  test("devnet tx URL includes cluster param", () => {
    const url = explorerTxUrl("sig123", "devnet");
    expect(url).toBe("https://explorer.solana.com/tx/sig123?cluster=devnet");
  });
});

// ---------------------------------------------------------------------------
// decodeTransactionError
// ---------------------------------------------------------------------------
describe("decodeTransactionError", () => {
  test("returns empty string for user rejection", () => {
    const err = new Error("user rejected the request");
    expect(decodeTransactionError(err)).toBe("");
  });

  test("returns empty string for WalletSignTransactionError", () => {
    const err = new Error("cancelled");
    err.name = "WalletSignTransactionError";
    expect(decodeTransactionError(err)).toBe("");
  });

  test("decodes blockhash not found", () => {
    const err = new Error("Blockhash not found");
    expect(decodeTransactionError(err)).toMatch(/too long/i);
  });

  test("decodes insufficient funds for rent", () => {
    const err = new Error("insufficient funds for rent");
    expect(decodeTransactionError(err)).toMatch(/rent/i);
  });

  test("decodes generic insufficient funds", () => {
    const err = new Error("insufficient funds");
    expect(decodeTransactionError(err)).toMatch(/not enough sol/i);
  });

  test("decodes slippage tolerance exceeded", () => {
    const err = new Error("SlippageToleranceExceeded");
    expect(decodeTransactionError(err)).toMatch(/slippage/i);
  });

  test("decodes simulation failure", () => {
    const err = new Error("Transaction simulation failed");
    expect(decodeTransactionError(err)).toMatch(/simulation failed/i);
  });

  test("returns generic message for non-Error", () => {
    expect(decodeTransactionError("oops")).toBe("An unknown error occurred.");
  });

  test("passes through unknown error messages", () => {
    const err = new Error("something unexpected");
    expect(decodeTransactionError(err)).toBe("something unexpected");
  });
});
