import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [{ source: "/_AMapService/:path*", destination: "/api/amap/:path*" }];
  },
};

export default nextConfig;
