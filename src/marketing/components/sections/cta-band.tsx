import type { PageSection } from "@/marketing/lib/types";

type Cta = Extract<PageSection, { type: "cta" }>;

export function CtaBandSection({ section }: { section: Cta }) {
  return (
    <section className="border-t border-zinc-200 bg-zinc-900 text-white dark:border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-headline max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {section.title}
        </h2>
        {section.subtitle ? (
          <p className="mt-3 max-w-xl text-zinc-300 dark:text-zinc-600">
            {section.subtitle}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={section.primaryCta.href}
            className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            {section.primaryCta.label}
          </a>
          {section.secondaryCta ? (
            <a
              href={section.secondaryCta.href}
              className="inline-flex rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 dark:border-zinc-400 dark:text-zinc-900 dark:hover:bg-zinc-200/60"
            >
              {section.secondaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
