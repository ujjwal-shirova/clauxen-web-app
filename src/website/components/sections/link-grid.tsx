import Link from "next/link";
import type { PageSection } from "@/website/lib/types";
import { SectionShell } from "@/website/components/ui";

type LinkGrid = Extract<PageSection, { type: "link-grid" }>;

export function LinkGridSection({ section }: { section: LinkGrid }) {
  return (
    <SectionShell className="py-16 sm:py-20">
      {section.title ? (
        <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {section.title}
        </h2>
      ) : null}
      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${section.title ? "mt-8" : ""}`}>
        {section.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {item.title}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {item.body}
            </p>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
