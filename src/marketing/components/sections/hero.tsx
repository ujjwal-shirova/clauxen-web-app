import type { PageSection } from "@/marketing/lib/types";
import { PrimaryButton, SecondaryButton } from "@/marketing/components/ui";

type Hero = Extract<PageSection, { type: "hero" }>;

export function HeroSection({ section }: { section: Hero }) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/70 dark:border-zinc-800/70">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.05),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.05),_transparent_55%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        {section.eyebrow ? (
          <p className="font-headline text-sm tracking-wide text-zinc-500">
            {section.eyebrow}
          </p>
        ) : null}
        <h1 className="font-headline mt-3 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl md:text-[3.4rem] dark:text-zinc-50">
          {section.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          {section.subtitle}
        </p>
        {(section.primaryCta || section.secondaryCta) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {section.primaryCta ? (
              <PrimaryButton {...section.primaryCta} />
            ) : null}
            {section.secondaryCta ? (
              <SecondaryButton {...section.secondaryCta} />
            ) : null}
          </div>
        )}
        {section.note ? (
          <p className="mt-4 text-sm text-zinc-500">{section.note}</p>
        ) : null}
      </div>
    </section>
  );
}
