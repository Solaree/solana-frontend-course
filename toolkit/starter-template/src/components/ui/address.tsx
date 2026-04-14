"use client";

import { useState } from "react";
import { Copy, CheckCheck, ExternalLink } from "lucide-react";
import { truncateAddress, explorerAddressUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";
import { cn } from "@/lib/utils";

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

interface AddressProps {
  address: string;
  chars?: number;
  showExplorer?: boolean;
  className?: string;
}

/**
 * Displays a truncated Solana address with:
 * - Copy button (with "Copied!" confirmation)
 * - Optional Explorer link
 * - Monospace font
 */
export function Address({
  address,
  chars = 4,
  showExplorer = true,
  className,
}: AddressProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt("Copy address:", address);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="font-mono tabular-nums text-sm">
        {truncateAddress(address, chars)}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Address copied" : "Copy address"}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <span
          className="flex h-3.5 w-3.5 items-center justify-center"
          style={{
            transition: "transform 0.15s ease, opacity 0.15s ease",
            transform: copied ? "scale(1.2)" : "scale(1)",
            opacity: copied ? 1 : 0.7,
          }}
        >
          {copied ? (
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>

      {showExplorer && (
        <a
          href={explorerAddressUrl(address, CLUSTER)}
          target="_blank"
          rel="noreferrer"
          aria-label="View on Solana Explorer (opens in new tab)"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </span>
  );
}
