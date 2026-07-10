"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

/** Client-only so it never blocks the initial HTML/FCP path. */
export function ClientSpeedInsights() {
  return <SpeedInsights />;
}
