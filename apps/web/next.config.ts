import { config } from "dotenv";
import type { NextConfig } from "next";

// Loads the monorepo-root `.env` in-process (docs/DEPLOYMENT.md §3) — same convention
// packages/db/packages/core use, but in-process rather than via a wrapper subprocess:
// dotenv-cli's process wrapping breaks Turbopack's build workers (`_global-error`
// prerender crash), so this must run inside next.config.ts, not in the npm script.
config({ path: "../../.env" });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@1crore-pixels/ui",
    "@1crore-pixels/core",
    "@1crore-pixels/db",
    "@1crore-pixels/payment-providers",
  ],
};

export default nextConfig;
