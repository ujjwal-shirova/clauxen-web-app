"use client";

import dynamic from "next/dynamic";

/**
 * Analytics / Speed Insights load third-party scripts that Attack Challenge
 * can briefly interrupt. Keep them out of the React render path that can
 * trip the main error boundary.
 */
const AnalyticsLazy = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false, loading: () => null },
);

const SpeedInsightsLazy = dynamic(
  () =>
    import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false, loading: () => null },
);

export function ClientTelemetry() {
  return (
    <>
      <SpeedInsightsLazy />
      <AnalyticsLazy />
    </>
  );
}
