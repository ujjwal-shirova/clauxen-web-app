import { Skeleton } from "@/components/ui/skeleton";

export function AppRouteLoadingShell({ label }: { label: string }) {
  return (
    <div
      className="app-page-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)]"
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      <div className="mx-auto w-full max-w-[880px] px-4 pt-8 sm:px-6">
        <Skeleton className="h-6 w-36" variant="text" />
        <div className="mt-5 flex items-center gap-2">
          <Skeleton className="h-8 flex-1 rounded-[8px]" />
          <Skeleton className="h-8 w-24 rounded-[8px]" />
        </div>
        <div className="mt-5 flex flex-col gap-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-3 px-2">
              <Skeleton className="size-7 rounded-[7px]" />
              <Skeleton
                className="h-3 flex-1"
                variant="text"
                style={{ ["--skeleton-delay" as string]: `${index * 60}ms`, maxWidth: `${60 - (index % 3) * 12}%` }}
              />
              <Skeleton className="h-3 w-16" variant="text" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
