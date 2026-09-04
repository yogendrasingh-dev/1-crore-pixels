import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@1crore-pixels/ui",
    "@1crore-pixels/core",
    "@1crore-pixels/db",
    "@1crore-pixels/payment-providers",
  ],
};

export default nextConfig;
