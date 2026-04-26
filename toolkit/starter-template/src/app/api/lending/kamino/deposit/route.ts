import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { KAMINO_MAIN_MARKET } from "@/lib/lending";

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

// ─── @solana/kit → @solana/web3.js conversion ────────────────────────────────
//
// AccountRole enum (from @solana/kit / @solana/instructions):
//   WRITABLE_SIGNER = 3, READONLY_SIGNER = 2, WRITABLE = 1, READONLY = 0
// → isSigner   = role >= 2
// → isWritable = (role & 1) !== 0
function kitIxToWeb3Ix(ix: any): TransactionInstruction {
  const accounts = (ix.accounts ?? []).map((acc: any) => ({
    pubkey: new PublicKey(acc.address),
    isSigner: acc.role >= 2,
    isWritable: (acc.role & 1) !== 0,
  }));

  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: accounts,
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { mint, amount, wallet } = (await req.json()) as {
      mint: string;   // mainnet mint address
      amount: string; // base units as string (e.g. "1000000" for 1 USDC)
      wallet: string; // wallet public key
    };

    // Lazy-import klend-sdk + kit (server-only externals — see next.config.ts).
    const { address, createNoopSigner, createSolanaRpc } = await import(
      "@solana/kit"
    );
    const { KaminoMarket, KaminoAction, VanillaObligation, PROGRAM_ID } =
      await import("@kamino-finance/klend-sdk");

    const rpc = createSolanaRpc(getRpcEndpoint());
    const marketAddress = address(KAMINO_MAIN_MARKET);
    const ownerAddress = address(wallet);
    const ownerSigner = createNoopSigner(ownerAddress);
    const mintAddress = address(mint);

    // Load Kamino main market (recentSlotDurationMs ≈ 460 ms on mainnet).
    // Cast rpc to any — pnpm resolves two @solana/kit majors (project's v6
    // and klend-sdk's internal v2). The runtime shape is identical for the
    // RPC methods KaminoMarket needs.
    const market = await KaminoMarket.load(
      rpc as any,
      marketAddress,
      460,
      PROGRAM_ID
    );
    if (!market) throw new Error("Kamino market not found");

    // Look up an existing obligation for this wallet (null on first deposit).
    const obligation = await market.getObligationByWallet(
      ownerAddress,
      new VanillaObligation(PROGRAM_ID)
    );

    const kaminoAction = await KaminoAction.buildDepositTxns(
      market,
      amount,
      mintAddress,
      ownerSigner,
      obligation ?? new VanillaObligation(PROGRAM_ID),
      true,      // useV2Ixs
      undefined  // scopeRefreshConfig (omit — Kamino prices don't need a scope refresh for vanilla deposits)
    );

    // Canonical Kamino ix order — mirrors KaminoAction.actionToIxs():
    //   computeBudgetIxs → setupIxs → lendingIxs (with inBetweenIxs between each pair) → cleanupIxs
    // computeBudgetIxs is REQUIRED — without it Kamino blows past the default
    // 200k CU limit and the wallet's preflight simulation fails silently
    // (which is what makes the wallet popup never appear).
    const lendingIxsInterleaved: any[] = [];
    for (let i = 0; i < kaminoAction.lendingIxs.length; i++) {
      lendingIxsInterleaved.push(kaminoAction.lendingIxs[i]);
      if (i !== kaminoAction.lendingIxs.length - 1) {
        lendingIxsInterleaved.push(...kaminoAction.inBetweenIxs);
      }
    }
    const allKitIxs = [
      ...kaminoAction.computeBudgetIxs,
      ...kaminoAction.setupIxs,
      ...lendingIxsInterleaved,
      ...kaminoAction.cleanupIxs,
    ];
    const allIxs = allKitIxs.map(kitIxToWeb3Ix);

    // Build the v0 transaction with @solana/web3.js so it round-trips
    // through wallet-adapter's signTransaction() without any cross-library
    // wire-format ambiguity.
    const connection = new Connection(getRpcEndpoint(), "confirmed");
    const walletPk = new PublicKey(wallet);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: walletPk,
      recentBlockhash: blockhash,
      instructions: allIxs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    return NextResponse.json({
      transaction: Buffer.from(tx.serialize()).toString("base64"),
    });
  } catch (err) {
    console.error("[kamino/deposit] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
