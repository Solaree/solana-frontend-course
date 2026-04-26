import type { NextConfig } from "next";
import path from "path";

// rpc-websockets v9 dropped the dist/lib/client* sub-paths that
// @solana/web3.js v1.77 (jito-ts) and v1.92 (solend-sdk) still import.
// Those versions do:
//   var CommonClientMod = require('rpc-websockets/dist/lib/client[.cjs]');
//   class RpcWebSocketClient extends CommonClientMod.default { ... }
// so the old sub-path's *default export* was the CommonClient constructor.
// Shim files in src/_shims/ re-export just that class/factory so that
// `_interopDefaultCompat(shim).default` returns a real constructor.
const shimClient  = path.resolve("./src/_shims/rpc-websockets-client.cjs");
const shimWs      = path.resolve("./src/_shims/rpc-websockets-websocket.cjs");

const nextConfig: NextConfig = {
  // Keep klend-sdk and its @solana/kit deps external so Next.js doesn't try
  // to bundle them through webpack (they use native Node.js APIs).
  serverExternalPackages: [
    "@kamino-finance/klend-sdk",
    "@solana/kit",
    "@solana/compat",
    "@solana-program/address-lookup-table",
    "@solana-program/system",
    "@solana-program/token",
    "@solana-program/token-2022",
    "@solana/sysvars",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
      // rpc-websockets v9 dropped dist/lib/client* sub-paths. Shims
      // re-export only CommonClient / WebSocket as the default so that
      // `_interopDefaultCompat(shim).default` returns a real constructor.
      "rpc-websockets/dist/lib/client$":               shimClient,
      "rpc-websockets/dist/lib/client.cjs$":           shimClient,
      "rpc-websockets/dist/lib/client/websocket$":     shimWs,
      "rpc-websockets/dist/lib/client/websocket.cjs$": shimWs,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
      // `encoding` is an optional peer of node-fetch used inside
      // @solendprotocol/token2022-wrapper-sdk; silence the warning.
      encoding: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      // Jupiter token icon CDN
      { protocol: "https", hostname: "lite-api.jup.ag" },
      // Fallback sources
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "**.ipfs.nftstorage.link" },
    ],
  },
};

export default nextConfig;
