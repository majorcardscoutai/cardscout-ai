import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // To test on your iPhone over Wi-Fi, add your Mac's local IP here, e.g. ["192.168.1.20"]
  allowedDevOrigins: [],
};

export default nextConfig;
