import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@shared": path.resolve(__dirname, "../../shared"),
    };
    return config;
  },
  htmlLimitedBots: /.*/,

  images: {
    qualities: [75, 90], // ✅ разрешаем 90
  },
};

export default nextConfig;
