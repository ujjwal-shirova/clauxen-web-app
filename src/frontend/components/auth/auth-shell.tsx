"use client";

import { LoginDemoPlayer } from "@/frontend/components/auth/login-demo";

const NAV = [
  { label: "Product", href: "/#product" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Enterprise", href: "/contact-sales" },
  { label: "Docs", href: "/#docs" },
] as const;

function AuthHeader() {
  return (
    <header className="flex shrink-0 items-center gap-4 px-5 py-4 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-5 text-[13px] text-zinc-500">
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
 * Auth layout — login column (header + form) beside a wallpapered demo rail.
 * Header never spans the animation. Mobile: login only, centered.
 * Frame sizing / scene transitions live inside LoginDemoPlayer.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] p-1.5 font-sans text-zinc-800 sm:p-2">
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden rounded-[16px] border border-zinc-200/80 bg-[var(--app-panel-bg)] sm:rounded-[18px]">
        {/* Login — header only lives here */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AuthHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 sm:px-8 lg:px-10">
            <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-4 sm:py-6">
              {children}
            </div>
          </div>
        </div>

        {/* Demo — wallpaper stage; player owns the macOS window frame */}
        <aside
          className="login-demo-rail relative hidden min-h-0 w-[min(54%,640px)] shrink-0 self-stretch overflow-hidden lg:flex lg:items-center lg:justify-center lg:p-8 xl:p-10"
          aria-hidden
        >
          <LoginDemoPlayer />
        </aside>
      </div>
    </div>
  );
}
