import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import { getSavePoolConfig, findReserve } from "../_lib";

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

function extractIxs(items: any[]): TransactionInstruction[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    item && typeof item === "object" && "instruction" in item
      ? item.instruction
      : item
  );
}

export async function POST(req: NextRequest) {
  try {
    const { mint, amount, wallet } = (await req.json()) as {
      mint: string;   // token mint address
      amount: string; // base units
      wallet: string;
    };

    // Lazily import the SDK — webpack bundles this server-side so rpc-websockets
    // is resolved through the bundler rather than Node.js native require.
    const { SolendActionCore } = await import(
      "@solendprotocol/solend-sdk/core/actions"
    );

    const pool = await getSavePoolConfig();
    const reserve = await findReserve(pool, mint);
    const connection = new Connection(getRpcEndpoint(), "confirmed");
    const walletPk = new PublicKey(wallet);

    const action = await SolendActionCore.buildDepositTxns(
      pool,
      reserve,
      connection,
      amount,
      { publicKey: walletPk },
      { environment: "production" }
    );

    const allIxs = extractIxs([
      ...action.preTxnIxs,
      ...action.setupIxs,
      ...action.lendingIxs,
      ...action.cleanupIxs,
      ...action.postTxnIxs,
    ]);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: walletPk,
      recentBlockhash: blockhash,
      instructions: allIxs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    return NextResponse.json({
      transaction: Buffer.from(tx.serialize()).toString("base64"),
      lastValidBlockHeight,
    });
  } catch (err) {
    console.error("[save/deposit] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
