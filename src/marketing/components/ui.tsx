import type { Cta } from "@/marketing/lib/types";

export function PrimaryButton({ href, label }: Cta) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
    >
      {label}
    </a>
  );
}

export function SecondaryButton({ href, label }: Cta) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
    >
      {label}
    </a>
  );
}

export function SectionShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}
