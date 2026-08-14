import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://signal-wg4o.onrender.com/:path*",
      },
    ];
  },
};

export default nextConfig;