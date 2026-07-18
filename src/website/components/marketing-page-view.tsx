import type { MarketingPage, PageSection } from "@/website/lib/types";
import { HeroSection } from "@/website/components/sections/hero";
import { FeaturesSection } from "@/website/components/sections/features";
import { LinkGridSection } from "@/website/components/sections/link-grid";
import { BulletsSection } from "@/website/components/sections/bullets";
import { PlansSection } from "@/website/components/sections/plans";
import { FaqSection } from "@/website/components/sections/faq";
import { CtaBandSection } from "@/website/components/sections/cta-band";

function Section({ section }: { section: PageSection }) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} />;
    case "features":
      return <FeaturesSection section={section} />;
    case "link-grid":
      return <LinkGridSection section={section} />;
    case "bullets":
      return <BulletsSection section={section} />;
    case "plans":
      return <PlansSection section={section} />;
    case "faq":
      return <FaqSection section={section} />;
    case "cta":
      return <CtaBandSection section={section} />;
    default:
      return null;
  }
}

export function MarketingPageView({ page }: { page: MarketingPage }) {
  return (
    <article>
      {page.sections.map((section, i) => (
        <Section key={`${section.type}-${i}`} section={section} />
      ))}
    </article>
  );
}
