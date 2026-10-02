import type { Metadata } from "next";

type MarketingPlaceholderProps = {
  title: string;
  eyebrow: string;
  description: string;
};

export const marketingPlaceholderMetadata = (
  title: string,
  description: string,
): Metadata => ({
  title: `${title} - Clauxen`,
  description,
});

/**
 * Shared shell for marketing routes that have not been built out yet.
 * Replace the body of each page as the section is designed; keep the
 * metadata helper so SEO stays consistent.
 */
export function MarketingPlaceholder({
  title,
  eyebrow,
  description,
}: MarketingPlaceholderProps) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-shell-bg)] px-5 py-16 text-zinc-900 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600">
          {description}
        </p>
        <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-6">
          <p className="text-sm text-zinc-500">
            This marketing route is scaffolded and ready to be built out.
          </p>
        </div>
        <a
          href="/"
          className="mt-10 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <img
            src="/assets/icons/clauxen-icon.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
          Back to Clauxen
        </a>
      </div>
    </main>
  );
}
