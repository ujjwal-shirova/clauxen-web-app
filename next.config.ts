import type { NextConfig } from "next";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

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

function r2ImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
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
    {
      protocol: "https",
      hostname: "*.r2.dev",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "*.r2.cloudflarestorage.com",
      port: "",
      pathname: "/**",
    },
  ];

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (publicBase) {
    try {
      const { hostname, protocol } = new URL(publicBase);
      if (hostname) {
        patterns.push({
          protocol: (protocol.replace(":", "") || "https") as "http" | "https",
          hostname,
          port: "",
          pathname: "/**",
        });
      }
    } catch {
      // ignore invalid R2_PUBLIC_BASE_URL at build time
    }
  }

  return patterns;
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // ponytail: baseline CSP — API keys never appear in inline scripts; Next uses nonces in prod builds
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://*.r2.dev https://*.cloudflarestorage.com",
      "frame-src 'self' https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: [
    "novita-sandbox",
    "pg",
    "razorpay",
    "undici",
    "@node-rs/argon2",
    "bcrypt",
  ],
  transpilePackages: ["streamdown"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "recharts",
      "framer-motion",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
    ],
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/backend/email-verifier/disposable.txt"],
    "/auth/**/*": ["./src/backend/email-verifier/disposable.txt"],
    "/*": ["./src/backend/email-verifier/disposable.txt"],
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: r2ImagePatterns(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
