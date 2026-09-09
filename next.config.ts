import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow pdfjs worker via CDN; no special config needed
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
};

export default nextConfig;
