import type { Metadata } from "next";

export type Cta = { label: string; href: string };

export type PageSection =
  | {
      type: "hero";
      eyebrow?: string;
      title: string;
      subtitle: string;
      primaryCta?: Cta;
      secondaryCta?: Cta;
      note?: string;
    }
  | {
      type: "features";
      title?: string;
      subtitle?: string;
      items: { title: string; body: string }[];
    }
  | {
      type: "bullets";
      title: string;
      items: string[];
    }
  | {
      type: "link-grid";
      title?: string;
      items: { title: string; body: string; href: string }[];
    }
  | {
      type: "plans";
      title?: string;
      subtitle?: string;
      items: {
        name: string;
        price: string;
        blurb: string;
        features: string[];
        cta: Cta;
        highlight?: boolean;
      }[];
    }
  | {
      type: "faq";
      title?: string;
      items: { q: string; a: string }[];
    }
  | {
      type: "cta";
      title: string;
      subtitle?: string;
      primaryCta: Cta;
      secondaryCta?: Cta;
    };

export type MarketingPage = {
  path: string;
  title: string;
  description: string;
  sections: PageSection[];
};

export function pageMeta(page: MarketingPage): Metadata {
  return {
    title: page.title,
    description: page.description,
  };
}

export function definePage(
  path: string,
  title: string,
  description: string,
  sections: PageSection[],
): MarketingPage {
  return { path, title, description, sections };
}
