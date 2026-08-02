"use client";

import "bootstrap-icons/font/bootstrap-icons.css";

const NAV = [
  { label: "Product", href: "/#product" },
  { label: "Pricing", href: "/new#pricing" },
  { label: "Enterprise", href: "/contact-sales" },
  { label: "Docs", href: "/#docs" },
] as const;

function AuthHeader() {
  return (
    <header className="flex w-full shrink-0 items-center justify-center border-b border-black/[0.045] px-5 py-4 sm:px-6">
      <nav className="flex items-center gap-6 text-[13px] font-medium text-zinc-500">
        <a
          href="/#product"
          className="inline-flex items-center gap-2 transition-colors hover:text-zinc-900"
        >
          <img
            src="/assets/icons/clauxen-icon.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span>Product</span>
        </a>
        {NAV.slice(1).map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="transition-colors hover:text-zinc-900"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/**
 * Auth layout — single centered column (no demo rail / split view).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.10),transparent_34%),var(--app-shell-bg)] p-2 font-sans text-zinc-800 sm:p-3">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[20px] border border-white/70 bg-[var(--app-panel-bg)] shadow-[0_20px_60px_-36px_rgba(22,24,42,0.42)] sm:rounded-[24px]">
        <AuthHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-6 sm:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
