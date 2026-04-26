// ─── Jito Staking constants ──────────────────────────────────────────────────
//
// Jito's liquid staking pool runs on the standard SPL Stake Pool program.
// Depositing SOL mints JitoSOL at the pool's current exchange rate; the
// JitoSOL token accrues yield in-place by appreciating against SOL each
// epoch as MEV + staking rewards land.
//
// Pool address is the on-chain stake-pool config account. The mint and
// reserve PDAs derive from it, but the pool address alone is enough for
// `@solana/spl-stake-pool` to figure out the rest.

export const JITO_STAKE_POOL = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb";

export const JITOSOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export const JITOSOL_DECIMALS = 9;

// ─── Public types shared between API + hooks ────────────────────────────────

export type JitoInfo = {
  /** Annual percentage yield, expressed as a decimal (0.054 = 5.4%). */
  apy: number;
  /** SOL per 1 JitoSOL — multiply your JitoSOL balance to get SOL value. */
  exchangeRate: number;
  /** Total SOL staked in the pool, in lamports. */
  tvlLamports: number;
  /** Total JitoSOL minted, in base units. */
  supplyBaseUnits: number;
};

// Liquid-staking action labels. Mirrors the LendingAction shape so the
// lending form can switch between them without restructuring its UI.
export type StakingAction = "stake" | "unstake";
