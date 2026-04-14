"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { CheckCheck, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { truncateAddress, explorerAddressUrl } from "@/lib/format";
import { CLUSTER } from "@/lib/solana";

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for HTTP / local network (clipboard API requires HTTPS)
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export function WalletButton() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function openMenu() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  }

  async function handleCopy() {
    if (!publicKey) return;
    try {
      await copyToClipboard(publicKey.toBase58());
      setCopied(true);
      // Show "Copied!" for 1.2 s, then close the menu
      setTimeout(() => {
        setCopied(false);
        setTimeout(() => setOpen(false), 150); // brief pause after icon resets
      }, 1200);
    } catch {
      window.prompt("Copy your address:", publicKey.toBase58());
    }
  }

  if (connecting) {
    return (
      <button
        disabled
        aria-label="Connecting wallet"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" aria-hidden />
        Connecting…
      </button>
    );
  }

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Wallet className="h-4 w-4" aria-hidden />
        Connect Wallet
      </button>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Wallet: ${publicKey.toBase58()}`}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-mono text-sm font-medium tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{ boxShadow: "0 0 6px 1px rgba(52,211,153,0.5)" }}
          aria-hidden
        />
        {truncateAddress(publicKey)}
      </button>

      {/* Portal — renders directly in document.body, escaping ALL stacking contexts */}
      {mounted && open && createPortal(
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            aria-hidden
            onClick={() => setOpen(false)}
          />

          {/* Menu */}
          <div
            role="menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
              width: 208,
            }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Connected wallet</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">
                {truncateAddress(publicKey, 6)}
              </p>
            </div>

            <div className="p-1">
              <button
                role="menuitem"
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleCopy();
                  // menu stays open — handleCopy closes it after showing "Copied!"
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                {/* Icon animates scale on swap */}
                <span
                  className="flex h-4 w-4 items-center justify-center"
                  style={{
                    transition: "transform 0.15s ease, opacity 0.15s ease",
                    transform: copied ? "scale(1.2)" : "scale(1)",
                    opacity: copied ? 1 : 0.7,
                  }}
                >
                  {copied
                    ? <CheckCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                    : <Copy className="h-4 w-4" aria-hidden />}
                </span>
                <span
                  style={{
                    transition: "color 0.15s ease",
                    color: copied ? "rgb(52 211 153)" : "",
                  }}
                >
                  {copied ? "Copied!" : "Copy address"}
                </span>
              </button>

              <button
                role="menuitem"
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  window.open(
                    explorerAddressUrl(publicKey.toBase58(), CLUSTER),
                    "_blank",
                    "noreferrer"
                  );
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden />
                View on Explorer
              </button>

              <div className="my-1 border-t border-border" />

              <button
                role="menuitem"
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Disconnect
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
