import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the local database, lib/pg.ts) loads its own WebAssembly files,
  // so Node loads it directly instead of the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    agentFeedback: true,
    // Allow photo uploads of up to ~25 MB per request.
    serverActions: {
      bodySizeLimit: "25mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
  cacheComponents: true,
  async redirects() {
    return [
      { source: "/dashboard", destination: "/dashboard/manage/photos", permanent: false },
      { source: "/dashboard/manage", destination: "/dashboard/manage/photos", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
