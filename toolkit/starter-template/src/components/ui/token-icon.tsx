"use client";

import { useState } from "react";
import Image from "next/image";
import { Coins } from "lucide-react";
import { tokenIcon } from "@/lib/jupiter";

interface TokenIconProps {
  /** Token mint address */
  mint: string;
  /** Display size in px (default 36) */
  size?: number;
  /** Optional CSS class on the wrapper */
  className?: string;
}

/**
 * Renders a token icon from Jupiter's CDN with a graceful fallback.
 * Falls back to a generic coin icon if the image fails to load.
 */
export function TokenIcon({ mint, size = 36, className = "" }: TokenIconProps) {
  const [failed, setFailed] = useState(false);
  const iconSrc = tokenIcon(mint);

  // If cache is empty or image previously failed, show fallback
  if (!iconSrc || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 ${className}`}
        style={{ width: size, height: size }}
      >
        <Coins
          className="text-primary/70"
          style={{ width: size * 0.44, height: size * 0.44 }}
          aria-hidden
        />
      </div>
    );
  }

  // Only render Image when we have a non‑empty src
  return (
    <Image
      src={iconSrc}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
