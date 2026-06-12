import type { NextConfig } from "next";
import os from "node:os";

function getLocalNetworkHosts(): string[] {
  const hosts = new Set<string>();

  for (const entries of Object.values(os.networkInterfaces())) {
    if (!entries) continue;
    for (const entry of entries) {
      const isIPv4 = entry.family === "IPv4" || String(entry.family) === "4";
      if (isIPv4 && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }

  return [...hosts];
}

function getAllowedDevOrigins(): string[] {
  const fromEnv =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return [...new Set([...fromEnv, ...getLocalNetworkHosts()])];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  serverExternalPackages: [
    "novita-sandbox",
    "pg",
    "razorpay",
    "@ory/hydra-client",
    "@ory/kratos-client",
  ],
  /** Next.js 16 defaults to Turbopack; empty config silences webpack-migration warning. */
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
