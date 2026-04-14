import { CLUSTER } from "@/lib/solana";

export function ClusterBadge() {
  if (CLUSTER === "mainnet-beta") return null;

  return (
    <span
      className="inline-flex items-center rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-yellow-400"
      aria-label={`Connected to Solana ${CLUSTER}`}
    >
      {CLUSTER}
    </span>
  );
}
