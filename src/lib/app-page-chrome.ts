import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";

/**
 * Shared product-surface chrome — page titles, search fields, empty states.
 * Keeps Projects / Library / Scheduled / settings-adjacent pages visually aligned.
 */
export const appPage = {
  surface:
    "app-page-surface flex h-full w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans text-zinc-900 dark:text-zinc-50",
  headerBleed: "w-full shrink-0 border-b border-zinc-100/90 dark:border-white/[0.06]",
  headerInner:
    "mobile-page-inset mx-auto w-full max-w-[880px] pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-5 sm:pt-6 lg:pt-7",
  title:
    "text-[24px] font-semibold leading-[1.25] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 sm:text-[28px] sm:leading-[34px]",
  titleWide:
    "text-[24px] font-semibold leading-[1.25] tracking-[-0.03em] text-zinc-900 dark:text-zinc-50 sm:text-[28px] sm:leading-[34px]",
  subtitle: "mt-1 text-[13px] leading-5 text-zinc-500 dark:text-zinc-400",
  searchWrap: "relative mt-4 sm:mt-5",
  searchIcon:
    "pointer-events-none absolute left-3.5 top-1/2 icon-md -translate-y-1/2 text-zinc-400",
  searchInput:
    "h-10 w-full rounded-xl border border-zinc-200/90 bg-white pl-10 pr-4 text-[14px] text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/[0.06] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/20 dark:focus:ring-white/10",
  primaryCta: cn(
    appBtn.primary,
    "h-9 shrink-0 gap-1.5 rounded-lg px-4 text-[14px] font-medium shadow-none",
  ),
  outlineCta: cn(
    appBtn.secondary,
    "h-9 rounded-lg px-4 text-[13.5px] font-medium",
  ),
  emptyIconWell:
    "mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-50 text-zinc-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-600",
  emptyTitle: "mb-2 text-[15px] font-medium text-zinc-800 dark:text-zinc-100",
  emptyBody:
    "mb-6 max-w-[380px] text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400",
  content:
    "mobile-page-inset mx-auto w-full max-w-[880px] px-0 pb-24 pt-5 sm:px-6 sm:pt-6",
  contentWide:
    "mobile-page-inset mx-auto w-full max-w-[1120px] px-4 pb-24 pt-3 sm:px-8",
} as const;
