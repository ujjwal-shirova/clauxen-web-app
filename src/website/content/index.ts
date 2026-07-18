import type { MarketingPage } from "@/website/lib/types";
import { pageMeta } from "@/website/lib/types";
import { overviewPage } from "@/website/content/overview";
import { plansPage } from "@/website/content/plans";
import { downloadPage } from "@/website/content/download";
import { workPage } from "@/website/content/work";
import { codexPage, codexPricingPage } from "@/website/content/codex";
import {
  atlasPage,
  canvasPage,
  featuresAgentPage,
  featuresPage,
} from "@/website/content/features";
import { productPages } from "@/website/content/product";
import { businessPages } from "@/website/content/business";
import { solutionPages } from "@/website/content/solutions";
import { corePages } from "@/website/content/core";
import { hubPages } from "@/website/content/hubs";

/**
 * Single registry entrypoint — page bodies live in focused modules.
 * Route layer: src/app/(marketing)/[...slug]/page.tsx
 */
export const MARKETING_PAGES: MarketingPage[] = [
  overviewPage,
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
