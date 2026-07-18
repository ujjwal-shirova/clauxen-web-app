import type { PageSection } from "@/website/lib/types";
import { SectionShell } from "@/website/components/ui";

type Bullets = Extract<PageSection, { type: "bullets" }>;

export function BulletsSection({ section }: { section: Bullets }) {
  return (
    <SectionShell className="py-16 sm:py-20">
      <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {section.title}
      </h2>
      <ul className="mt-6 max-w-2xl space-y-3">
        {section.items.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            {item}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
