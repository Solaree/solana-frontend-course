import { describe, test, expect } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Integration tests — hit real devnet, no mocks.
 *
 * "Mock RPC diverges from prod — the lecture 2 assignment note applies here too."
 * — Lecture 4, Section 11
 */

const DEVNET_RPC = "https://api.devnet.solana.com";
const TEST_WALLET = new PublicKey("11111111111111111111111111111111"); // System Program — always exists

describe("RPC Integration (devnet)", () => {
  const connection = new Connection(DEVNET_RPC);

  test("getBalance returns >= 0 for a known address", async () => {
    const balance = await connection.getBalance(TEST_WALLET);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test("getLatestBlockhash returns a valid blockhash", async () => {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    expect(blockhash).toBeTruthy();
    expect(typeof blockhash).toBe("string");
    expect(lastValidBlockHeight).toBeGreaterThan(0);
  });

  test("getSlot returns a positive number", async () => {
    const slot = await connection.getSlot();
    expect(slot).toBeGreaterThan(0);
  });

  test("getEpochInfo returns current epoch data", async () => {
    const info = await connection.getEpochInfo();
    expect(info.epoch).toBeGreaterThan(0);
    expect(info.slotsInEpoch).toBeGreaterThan(0);
  });
});
