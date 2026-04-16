import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Required for @solana/web3.js and some wallet adapters
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      // Jupiter token icon CDN
      { protocol: "https", hostname: "api.jup.ag" },
      // Fallback sources
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "**.ipfs.nftstorage.link" },
    ],
  },
};

export default nextConfig;
