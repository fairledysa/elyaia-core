// FILE: next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "salla-dev.s3.eu-central-1.amazonaws.com",
        pathname: "/**",
      },
      // احتياط لو سلة تغيّر الدومين
      { protocol: "https", hostname: "cdn.salla.sa", pathname: "/**" },
      { protocol: "https", hostname: "cdn.salla.cloud", pathname: "/**" },
      { protocol: "https", hostname: "salla.sa", pathname: "/**" },
      { protocol: "https", hostname: "api.salla.dev", pathname: "/**" },
    ],
  },
};

export default nextConfig;
