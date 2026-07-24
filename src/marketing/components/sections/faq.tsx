import type { PageSection } from "@/marketing/lib/types";
import { SectionShell } from "@/marketing/components/ui";

type Faq = Extract<PageSection, { type: "faq" }>;

export function FaqSection({ section }: { section: Faq }) {
  return (
    <SectionShell className="py-16 sm:py-20">
      <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {section.title ?? "FAQ"}
      </h2>
      <div className="mt-8 max-w-3xl divide-y divide-zinc-200 dark:divide-zinc-800">
        {section.items.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="cursor-pointer list-none text-[15px] font-medium text-zinc-900 marker:content-none dark:text-zinc-50">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span className="text-zinc-400 transition group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}
