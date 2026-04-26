import { NextRequest, NextResponse } from "next/server";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { JITO_STAKE_POOL } from "@/lib/staking";

function getRpcEndpoint() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

export async function POST(req: NextRequest) {
  try {
    const { amount, wallet } = (await req.json()) as {
      amount: string; // lamports
      wallet: string;
    };

    if (!amount || !wallet) {
      return NextResponse.json(
        { error: "amount and wallet are required" },
        { status: 400 }
      );
    }

    const lamports = Number(amount);
    if (!Number.isFinite(lamports) || lamports <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive integer (lamports)" },
        { status: 400 }
      );
    }

    // Lazy-import the SDK so it isn't bundled into routes that don't need it.
    const { depositSol } = await import("@solana/spl-stake-pool");

    const connection = new Connection(getRpcEndpoint(), "confirmed");
    const walletPk = new PublicKey(wallet);
    const poolPk = new PublicKey(JITO_STAKE_POOL);

    // depositSol does NOT just return wallet-only instructions — it
    // generates an ephemeral Keypair (`userSolTransfer`) that the wallet
    // first transfers `lamports` into, and then the stake-pool program
    // pulls SOL from. That keypair is required to sign the tx, otherwise
    // preflight rejects with "Transaction did not pass signature
    // verification" (no logs, because it never reaches a program).
    const { instructions, signers } = await depositSol(
      connection,
      poolPk,
      walletPk,
      lamports
    );

    // Add a compute budget bump — stake pool deposits routinely use 80k–
    // 120k CUs (more than the 200k default header), and a small priority
    // fee helps the tx land within Jito's block window. Without a bump
    // some validators silently drop the tx during preflight.
    const allIxs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...instructions,
    ];

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: walletPk,
      recentBlockhash: blockhash,
      instructions: allIxs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    // Sign with the ephemeral signer(s) server-side BEFORE handing off to
    // the wallet. wallet-adapter's `signTransaction` preserves any
    // existing signatures and just appends the wallet's, so the wallet
    // sees a partially-signed tx and adds the missing payer signature.
    if (signers.length > 0) {
      tx.sign(signers);
    }

    return NextResponse.json({
      transaction: Buffer.from(tx.serialize()).toString("base64"),
    });
  } catch (err) {
    console.error("[staking/jito/stake] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
