import type { Cta, MarketingPage, PageSection } from "@/marketing/lib/types";
import { definePage } from "@/marketing/lib/types";

/** Shared CTAs used across marketing pages. */
export const CTA = {
  tryApp: { label: "Try Clauxen", href: "/login" },
  startFree: { label: "Start free", href: "/login" },
  viewPlans: { label: "View plans", href: "/plans" },
  contactSales: { label: "Contact sales", href: "/contact-sales" },
  download: { label: "Download", href: "/download" },
  openWeb: { label: "Open web app", href: "/login" },
} satisfies Record<string, Cta>;

export function hero(
  title: string,
  subtitle: string,
  opts?: Partial<Extract<PageSection, { type: "hero" }>>,
): PageSection {
  return {
    type: "hero",
    title,
    subtitle,
    primaryCta: CTA.tryApp,
    secondaryCta: CTA.viewPlans,
    ...opts,
  };
}

export function features(
  items: { title: string; body: string }[],
  title?: string,
  subtitle?: string,
): PageSection {
  return { type: "features", title, subtitle, items };
}

export function ctaBand(
  title: string,
  subtitle?: string,
  primary: Cta = CTA.tryApp,
  secondary?: Cta,
): PageSection {
  return {
    type: "cta",
    title,
    subtitle,
    primaryCta: primary,
    secondaryCta: secondary ?? CTA.contactSales,
  };
}

export function linkGrid(
  items: { title: string; body: string; href: string }[],
  title?: string,
): PageSection {
  return { type: "link-grid", title, items };
}

export function bullets(title: string, items: string[]): PageSection {
  return { type: "bullets", title, items };
}

export function faq(
  items: { q: string; a: string }[],
  title = "FAQ",
): PageSection {
  return { type: "faq", title, items };
}

/** Minimal product/solution page from a short brief. */
export function minimalProductPage(opts: {
  path: string;
  title: string;
  description: string;
  eyebrow?: string;
  headline: string;
  subtitle: string;
  points: { title: string; body: string }[];
}): MarketingPage {
  return definePage(opts.path, opts.title, opts.description, [
    hero(opts.headline, opts.subtitle, { eyebrow: opts.eyebrow }),
    features(opts.points),
    ctaBand("Continue in Clauxen"),
  ]);
}
