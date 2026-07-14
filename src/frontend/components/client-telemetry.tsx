"use client";

import dynamic from "next/dynamic";

/**
 * Analytics loads a third-party script that Attack Challenge can briefly
 * interrupt. Keep it out of the React render path that can trip the main
 * error boundary.
 */
const AnalyticsLazy = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false, loading: () => null },
);

export function ClientTelemetry() {
  return <AnalyticsLazy />;
}
