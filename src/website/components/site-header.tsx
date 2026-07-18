"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIMARY_NAV, SITE } from "@/website/lib/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[var(--app-panel-bg)]/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/overview"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/icons/clauxen-icon.png"
            alt="Clauxen"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          {SITE.brand}
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                {item.label}
              </Link>
              {item.children?.length ? (
                <div className="pointer-events-none absolute left-0 top-full z-50 min-w-[260px] pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {child.label}
                        </div>
                        {child.description ? (
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {child.description}
                          </div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={SITE.login}
            className="hidden rounded-full px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log in
          </Link>
          <Link
            href={SITE.login}
            className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Try Clauxen
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 lg:hidden dark:text-zinc-300"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <i
              className={`bi ${open ? "bi-x-lg" : "bi-list"} text-[20px]`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
