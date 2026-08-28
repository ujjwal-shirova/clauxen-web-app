"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Analytics loads a third-party script that Attack Challenge can briefly
 * interrupt. Keep it out of the React render path that can trip the main
 * error boundary.
 *
 * No Speed Insights / Observability Plus — verify with Playwright + CLI
 * smoke checks (see docs/perf-metrics.md).
 */
const AnalyticsLazy = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false, loading: () => null },
);

export function ClientTelemetry() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const syncStoredChoice = () => {
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem("clauxen.cookie-consent.v1") ?? "null",
        ) as { performance?: unknown } | null;
        setAllowed(parsed?.performance === true);
      } catch {
        setAllowed(false);
      }
    };
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<{ performance?: unknown }>).detail;
      setAllowed(detail?.performance === true);
    };

    syncStoredChoice();
    window.addEventListener("clauxen:cookie-consent", onConsent);
    return () =>
      window.removeEventListener("clauxen:cookie-consent", onConsent);
  }, []);

  return allowed ? <AnalyticsLazy /> : null;
}
