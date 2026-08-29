"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as cookiesApi from "@/lib/api/cookies";
import {
  COOKIE_CONSENT_EVENT,
  parseUtmAttribution,
  readBrowserConsent,
  readBrowserUtm,
  writeBrowserUtm,
  type CookieConsentValue,
  type CookieEventCategory,
  type CookieUtmAttribution,
} from "@/lib/cookie-consent";

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

function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);

  useEffect(() => {
    const syncStoredChoice = () => {
      setConsent(readBrowserConsent());
    };
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsentValue>).detail;
      if (detail?.essential === true) {
        setConsent(detail);
        return;
      }
      syncStoredChoice();
    };

    syncStoredChoice();
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, []);

  return consent;
}

function recordEvent(input: {
  category: CookieEventCategory;
  eventType: string;
  path: string;
  referrer?: string | null;
  utm?: CookieUtmAttribution | null;
  payload?: Record<string, unknown>;
}) {
  void cookiesApi.recordCookieEvent(input).catch(() => undefined);
}

function FirstPartyCollectors({ consent }: { consent: CookieConsentValue }) {
  const pathname = usePathname() || "/";
  const lastPageView = useRef<string | null>(null);
  const sentNavigation = useRef(false);
  const sentLanding = useRef(false);
  const sentCampaign = useRef<string | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!consent.performance) {
      lastPageView.current = null;
      sentNavigation.current = false;
      return;
    }
    if (lastPageView.current === pathname) return;
    lastPageView.current = pathname;
    recordEvent({
      category: "performance",
      eventType: "page_view",
      path: pathname,
      referrer: document.referrer || null,
      payload: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });
  }, [consent.performance, pathname]);

  useEffect(() => {
    if (!consent.performance || sentNavigation.current) return;
    sentNavigation.current = true;
    const path = pathRef.current;

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav) {
      recordEvent({
        category: "performance",
        eventType: "web_vital",
        path,
        payload: {
          name: "navigation",
          ttfb: Math.round(nav.responseStart),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
        },
      });
    }

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries[entries.length - 1];
        if (!entry) return;
        recordEvent({
          category: "performance",
          eventType: "web_vital",
          path: pathRef.current,
          payload: {
            name: "LCP",
            value: Math.round(entry.startTime),
          },
        });
      });
      observer.observe({
        type: "largest-contentful-paint",
        buffered: true,
      });
    } catch {
      // Some browsers do not expose LCP.
    }

    return () => observer?.disconnect();
  }, [consent.performance]);

  useEffect(() => {
    if (!consent.advertising) {
      sentLanding.current = false;
      sentCampaign.current = null;
      return;
    }

    const fromUrl = parseUtmAttribution(window.location.search);
    if (fromUrl) writeBrowserUtm(fromUrl);
    const utm = fromUrl ?? readBrowserUtm();
    const campaignKey = fromUrl ? JSON.stringify(fromUrl) : null;

    if (fromUrl && sentCampaign.current !== campaignKey) {
      sentCampaign.current = campaignKey;
      recordEvent({
        category: "advertising",
        eventType: "campaign_touch",
        path: pathname,
        referrer: document.referrer || null,
        utm: fromUrl,
      });
    }

    if (sentLanding.current) return;
    sentLanding.current = true;
    recordEvent({
      category: "advertising",
      eventType: "landing",
      path: pathname,
      referrer: document.referrer || null,
      utm,
    });
  }, [consent.advertising, pathname]);

  return null;
}

export function ClientTelemetry() {
  const consent = useCookieConsent();

  return (
    <>
      {consent ? <FirstPartyCollectors consent={consent} /> : null}
      {consent?.performance ? <AnalyticsLazy /> : null}
    </>
  );
}
