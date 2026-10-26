import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const uploadsViaServer = !process.env.R2_ACCOUNT_ID;

const nextConfig: NextConfig = {
  // PGlite (the local database, lib/pg.ts) loads its own WebAssembly files,
  // so Node loads it directly instead of the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    agentFeedback: true,
    // With R2, photos go straight to storage (app/api/photos/start), so
    // actions only carry forms and designs and a small limit is plenty. Without
    // R2 (local development) the uploadPhotos action takes photos of up to
    // ~25 MB. The R2 settings are present when Vercel builds the app.
    serverActions: {
      bodySizeLimit: uploadsViaServer ? "25mb" : "2mb",
    },
    proxyClientMaxBodySize: uploadsViaServer ? "25mb" : "2mb",
  },
  // Photos are requested from the page's own host and fetched from the public
  // bucket by the server (see photoUrl in lib/uploads.ts).
  async rewrites() {
    const bucket = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
    return bucket ? [{ source: "/_photos/:path*", destination: `${bucket}/:path*` }] : [];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  cacheComponents: true,
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
