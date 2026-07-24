import type { MarketingPage } from "@/marketing/lib/types";
import { pageMeta } from "@/marketing/lib/types";
import { plansPage } from "@/marketing/content/plans";
import { downloadPage } from "@/marketing/content/download";
import { workPage } from "@/marketing/content/work";
import { codexPage, codexPricingPage } from "@/marketing/content/codex";
import {
  atlasPage,
  canvasPage,
  featuresAgentPage,
  featuresPage,
} from "@/marketing/content/features";
import { productPages } from "@/marketing/content/product";
import { businessPages } from "@/marketing/content/business";
import { solutionPages } from "@/marketing/content/solutions";
import { corePages } from "@/marketing/content/core";
import { hubPages } from "@/marketing/content/hubs";

/**
 * Single registry entrypoint — page bodies live in focused modules.
 * Route layer: src/app/(marketing)/[...slug]/page.tsx
 */
export const MARKETING_PAGES: MarketingPage[] = [
  // /overview → dedicated page at app/(marketing)/overview/page.tsx
  plansPage,
  downloadPage,
  workPage,
  codexPage,
  codexPricingPage,
  featuresPage,
  featuresAgentPage,
  canvasPage,
  atlasPage,
  ...productPages,
  ...businessPages,
  ...solutionPages,
  ...corePages,
  ...hubPages,
];

const byPath = new Map(MARKETING_PAGES.map((p) => [p.path, p]));

export function getMarketingPage(path: string): MarketingPage | undefined {
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  const key = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return byPath.get(key);
}

export function allMarketingPaths(): string[] {
  return MARKETING_PAGES.map((p) => p.path);
}

export function metadataForPage(path: string) {
  const page = getMarketingPage(path);
  if (!page) return { title: "Clauxen" };
  return pageMeta(page);
}
