"use client";

import { useState, useRef } from "react";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onRefetch: () => Promise<unknown>;
  label?: string;
}

const MIN_SPIN_MS = 700; // one full rotation at 0.7s — never stops mid-spin

/**
 * Refresh button that always completes at least one full rotation,
 * even when the underlying fetch returns instantly.
 */
export function RefreshButton({ onRefetch, label = "Refresh" }: RefreshButtonProps) {
  const [spinning, setSpinning] = useState(false);
  const startRef = useRef(0);

  async function handleClick() {
    if (spinning) return;
    setSpinning(true);
    startRef.current = Date.now();

    try {
      await onRefetch();
    } finally {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, MIN_SPIN_MS - elapsed);
      setTimeout(() => setSpinning(false), remaining);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
    >
      <RefreshCw
        className="h-3.5 w-3.5"
        style={{
          animation: spinning
            ? "spin-smooth 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite"
            : "none",
        }}
        aria-hidden
      />
    </button>
  );
}
