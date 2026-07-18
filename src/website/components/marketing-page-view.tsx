import Link from "next/link";
import type { MarketingPage, PageSection } from "@/website/content/pages";

function CtaLink({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: "primary" | "secondary";
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      : "border border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {label}
    </Link>
  );
}

function SectionView({ section }: { section: PageSection }) {
  switch (section.type) {
    case "hero":
      return (
        <section className="relative overflow-hidden border-b border-zinc-200/70 dark:border-zinc-800/70">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.06),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_55%)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            {section.eyebrow ? (
              <p className="font-headline text-sm tracking-wide text-zinc-500">
                {section.eyebrow}
              </p>
            ) : null}
            <h1 className="font-headline mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl md:text-6xl dark:text-zinc-50">
              {section.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              {section.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {section.primaryCta ? (
                <CtaLink
                  href={section.primaryCta.href}
                  label={section.primaryCta.label}
                  variant="primary"
                />
              ) : null}
              {section.secondaryCta ? (
                <CtaLink
                  href={section.secondaryCta.href}
                  label={section.secondaryCta.label}
                  variant="secondary"
                />
              ) : null}
            </div>
          </div>
        </section>
      );

    case "features":
      return (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
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
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
        </section>
      );

    case "bullets":
      return (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {section.title}
          </h2>
          <ul className="mt-6 space-y-3">
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
        </section>
      );

    case "split":
      return (
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              {section.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {section.body}
            </p>
            {section.cta ? (
              <div className="mt-6">
                <CtaLink
                  href={section.cta.href}
                  label={section.cta.label}
                  variant="primary"
                />
              </div>
            ) : null}
          </div>
          {section.points?.length ? (
            <ul className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              {section.points.map((point) => (
                <li key={point} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <div className="min-h-[180px] rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40" />
          )}
        </section>
      );

    case "cards":
      return (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          {section.title ? (
            <h2 className="font-headline text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {section.title}
            </h2>
          ) : null}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const inner = (
                <>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.body}
                  </p>
                </>
              );
              const className =
                "rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700";
              return item.href ? (
                <Link key={item.title} href={item.href} className={className}>
                  {inner}
                </Link>
              ) : (
                <div key={item.title} className={className}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      );

    case "cta":
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
              <Link
                href={section.primaryCta.href}
                className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                {section.primaryCta.label}
              </Link>
              {section.secondaryCta ? (
                <Link
                  href={section.secondaryCta.href}
                  className="inline-flex rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 dark:border-zinc-400 dark:text-zinc-900 dark:hover:bg-zinc-200/60"
                >
                  {section.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

export function MarketingPageView({ page }: { page: MarketingPage }) {
  return (
    <article>
      {page.sections.map((section, i) => (
        <SectionView key={`${section.type}-${i}`} section={section} />
      ))}
    </article>
  );
}
