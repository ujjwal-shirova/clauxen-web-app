import type { PageSection } from "@/marketing/lib/types";
import { SectionShell } from "@/marketing/components/ui";

type Features = Extract<PageSection, { type: "features" }>;

export function FeaturesSection({ section }: { section: Features }) {
  return (
    <SectionShell className="py-16 sm:py-20">
      {section.title ? (
        <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {section.title}
        </h2>
      ) : null}
      {section.subtitle ? (
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {section.subtitle}
        </p>
      ) : null}
      <div
        className={`grid gap-10 sm:grid-cols-2 lg:grid-cols-3 ${section.title ? "mt-10" : ""}`}
      >
        {section.items.map((item) => (
          <div key={item.title}>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {item.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
