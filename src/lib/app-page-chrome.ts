import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";

/**
 * Shared product-surface chrome — page titles, search fields, empty states.
 * Keeps Projects / Library / Scheduled / settings-adjacent pages visually aligned
 * with Cursor-compact tokens from globals.css.
 */
export const appPage = {
  surface:
    "app-page-surface flex h-full w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans text-zinc-900 dark:text-zinc-50",
  headerBleed:
    "w-full shrink-0 border-b border-[var(--ui-border-subtle)] dark:border-white/[0.06]",
  headerInner:
    "mobile-page-inset mx-auto w-full max-w-[var(--ui-page-max-width,880px)] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-4 sm:pt-5",
  title: "app-page-title",
  titleWide: "app-page-title",
  subtitle: "app-page-subtitle",
  searchWrap: "relative mt-3 sm:mt-4",
  searchIcon:
    "pointer-events-none absolute left-3 top-1/2 icon-md -translate-y-1/2 text-zinc-400",
  searchInput: "app-page-search",
  primaryCta: cn(appBtn.primary, "shrink-0 gap-1.5 shadow-none"),
  outlineCta: cn(appBtn.secondary, "shrink-0"),
  emptyIconWell:
    "mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-zinc-50 text-zinc-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-600",
  emptyTitle: "app-page-section-title mb-1.5",
  emptyBody: "app-page-muted mb-5 max-w-[380px]",
  content:
    "mobile-page-inset mx-auto w-full max-w-[var(--ui-page-max-width,880px)] px-0 pb-24 pt-4 sm:px-6 sm:pt-5",
  contentWide:
    "mobile-page-inset mx-auto w-full max-w-[var(--ui-page-max-width-wide,1120px)] px-4 pb-24 pt-3 sm:px-8",
  card: "app-page-card",
  row: "app-page-row",
  sectionTitle: "app-page-section-title",
  body: "app-page-body",
  muted: "app-page-muted",
  overlayPanel: "app-overlay-panel",
} as const;
