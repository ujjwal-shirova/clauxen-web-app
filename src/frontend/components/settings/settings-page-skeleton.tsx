"use client";

import { Skeleton } from "@/frontend/components/ui/skeleton";
import { settingsNav } from "@/frontend/components/settings/constants";

export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto h-full w-full max-w-[1160px] flex-1 overflow-y-auto bg-zinc-50 px-4 pt-5 sm:px-6 sm:pt-6"
      aria-hidden
    >
      <div className="mb-5 flex items-center justify-between sm:mb-7">
        <Skeleton className="h-7 w-28" variant="text" />
        <Skeleton className="h-9 w-9" variant="block" />
      </div>

      <div className="grid grid-cols-1 gap-5 pb-24 md:grid-cols-[220px_1fr] md:gap-10">
        <aside className="md:sticky md:top-4 self-start">
          <nav className="flex flex-col gap-0.5">
            {settingsNav.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2.5 px-2.5">
                <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-md" />
                <Skeleton
                  className="h-9 flex-1"
                  style={{ ["--skeleton-delay" as string]: `${index * 35}ms` }}
                />
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex max-w-[640px] flex-col gap-7">
          <section className="flex flex-col gap-4 border-b border-zinc-200 pb-8">
            <Skeleton className="h-24 w-full rounded-2xl" />
          </section>

          <section className="flex flex-col gap-4 border-b border-zinc-200 pb-8">
            <Skeleton className="h-5 w-24" variant="text" />
            <div className="flex gap-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Skeleton className="h-5 w-28" variant="text" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 py-1"
              >
                <Skeleton className="h-4 w-40" variant="text" />
                <Skeleton className="h-9 w-28" variant="pill" />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
