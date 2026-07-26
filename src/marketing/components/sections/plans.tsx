import type { PageSection } from "@/marketing/lib/types";
import { SectionShell } from "@/marketing/components/ui";

type Plans = Extract<PageSection, { type: "plans" }>;

export function PlansSection({ section }: { section: Plans }) {
  return (
    <SectionShell className="py-16 sm:py-20">
      {section.title ? (
        <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {section.title}
        </h2>
      ) : null}
      {section.subtitle ? (
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {section.subtitle}
        </p>
      ) : null}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {section.items.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col rounded-2xl border p-5 ${
              plan.highlight
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            }`}
          >
            <div className="text-sm font-medium opacity-70">{plan.blurb}</div>
            <div className="mt-1 text-xl font-semibold">{plan.name}</div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              {plan.price}
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm opacity-90">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a
              href={plan.cta.href}
              className={`mt-6 inline-flex justify-center rounded-full px-4 py-2 text-sm font-medium ${
                plan.highlight
                  ? "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              }`}
            >
              {plan.cta.label}
            </a>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
