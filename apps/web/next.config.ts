import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname)
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**"
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "1337",
        pathname: "/uploads/**"
      },
      {
        protocol: "http",
        hostname: "cms",
        port: "1337",
        pathname: "/uploads/**"
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/uploads/**"
      }
    ]
  }
};

export default nextConfig;
