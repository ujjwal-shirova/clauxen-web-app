import type { Cta } from "@/marketing/lib/types";

export function PrimaryButton({ href, label }: Cta) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-xl bg-[hsl(var(--brand))] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_5px_16px_hsl(var(--brand)/0.20)] transition-[background-color,box-shadow] hover:bg-[hsl(var(--brand-strong))] hover:shadow-[0_7px_20px_hsl(var(--brand)/0.24)] dark:text-white"
    >
      {label}
    </a>
  );
}

export function SecondaryButton({ href, label }: Cta) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/75 px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-[0_1px_2px_rgba(20,22,36,0.04)] backdrop-blur transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900"
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
