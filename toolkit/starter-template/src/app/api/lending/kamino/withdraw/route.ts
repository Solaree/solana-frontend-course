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

// See deposit/route.ts for a full explanation of this conversion.
// AccountRole values: WRITABLE_SIGNER=3, READONLY_SIGNER=2, WRITABLE=1, READONLY=0.
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
      mint: string;
      amount: string; // base units; pass "18446744073709551615" for full withdrawal
      wallet: string;
    };

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

    const market = await KaminoMarket.load(
      rpc as any,
      marketAddress,
      460,
      PROGRAM_ID
    );
    if (!market) throw new Error("Kamino market not found");

    const obligation = await market.getObligationByWallet(
      ownerAddress,
      new VanillaObligation(PROGRAM_ID)
    );
    if (!obligation) throw new Error("No open obligation found for this wallet");

    const kaminoAction = await KaminoAction.buildWithdrawTxns(
      market,
      amount,
      mintAddress,
      ownerSigner,
      obligation,
      true,      // useV2Ixs
      undefined  // scopeRefreshConfig
    );

    // Same canonical layout as deposit — see deposit/route.ts for the why.
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
    console.error("[kamino/withdraw] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
