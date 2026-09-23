import type { NextConfig } from "next";

// Set only in the deployed environment, where this app is reverse-proxied
// at eezisupport.co.za/assetregister alongside the Clock-In System at the
// domain root. Left unset for local dev, which runs at the origin root.
const basePath = process.env.NEXT_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
  // Client components fetch("/api/...") and reference public assets
  // ("/logo.png") with root-relative paths, which Next.js does not
  // automatically rewrite for basePath — see src/lib/basePath.ts, which
  // reads this at runtime to prefix them itself.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath ?? "",
  },
};

export default nextConfig;
