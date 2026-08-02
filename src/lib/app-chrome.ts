import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";

/**
 * Clauxen product chrome — React class catalog.
 *
 * Visual values (colors, type, radii, utilities, buttons) live ONLY in
 * `src/app/globals.css`. This module composes layout recipes that reference
 * those CSS classes / tokens. Prefer `chrome.*` over ad-hoc Tailwind.
 */

const page = {
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

const overlay = {
  /** Dialog / popup panel (Radix DialogContent, menus). */
  panel: "app-overlay-panel",
  dialog: "app-dialog-panel",
  /** Soft fullscreen wash behind modal shells. */
  scrim: "app-scrim",
  scrimStrong: "app-scrim--strong",
  /** Full-viewport product overlay (Gift, Pricing, Apps). */
  surface:
    "app-surface-shell fixed inset-0 z-[200] flex min-h-0 flex-col overflow-hidden outline-none",
  /** Centered modal shell on desktop (Settings). */
  modalShell:
    "app-surface-panel fixed z-[201] flex min-h-0 flex-col overflow-hidden inset-0 h-[100dvh] w-full md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(960px,calc(100vw-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-md)] md:border md:border-[var(--ui-border)] md:shadow-[var(--cursor-menu-shadow)]",
} as const;

const field = {
  base: "app-field",
  withIcons: "app-field app-field--icons",
  withTrailing: "app-field app-field--trailing",
  mutedPanel: "app-field-muted-panel",
} as const;

const checkout = {
  form: "app-page-surface w-full font-sans text-zinc-900",
  stack: "flex flex-col gap-5",
  section: "flex flex-col gap-3",

  field: field.base,
  fieldWithIcons: field.withIcons,
  fieldWithTrailingIcon: field.withTrailing,

  sectionTitle: "app-page-section-title px-0.5",
  panel: cn(page.card, "px-3.5 py-3 shadow-[var(--field-shadow)]"),
  panelMuted: field.mutedPanel,

  tabBase:
    "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border px-2 py-2.5 text-[length:var(--ui-font-size)] font-medium leading-[var(--ui-line-height)] transition-all duration-150",
  tabSelected: "border-zinc-900 bg-zinc-900 text-white",
  tabUnselected:
    "border-[var(--ui-border)] bg-[var(--ui-field-bg)] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",

  expressButton: cn(appBtn.primaryLg, "w-full gap-2"),

  iconButton:
    "ui-icon-button border border-transparent text-zinc-500 hover:border-[var(--ui-border)]",

  checkbox:
    "h-4 w-4 shrink-0 rounded border border-zinc-300 accent-zinc-900",
  labelMuted: page.muted,
  labelFine: "app-page-muted text-[12px]",
  errorText: "text-[length:var(--ui-font-size)] leading-[var(--ui-line-height)] text-red-600",

  payDisabled:
    "h-10 w-full cursor-not-allowed rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-200 text-[length:var(--ui-font-size)] font-medium text-white",

  hint: cn(
    page.muted,
    "flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-[var(--ui-muted-surface)] px-3.5 py-2.5",
  ),

  errorBanner:
    "mb-4 flex items-center rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-[length:var(--ui-font-size)] leading-[var(--ui-line-height)] text-red-800",

  orLine: "h-px flex-1 bg-zinc-200",
  orLabel: "px-1 text-[12px] font-medium text-zinc-500",
} as const;

export const chrome = {
  page,
  overlay,
  field,
  btn: appBtn,
  checkout,
} as const;

/** @deprecated Prefer `chrome.page` */
export const appPage = page;

/** @deprecated Prefer `chrome.checkout` */
export const checkoutUi = checkout;

export function checkoutTabClass(selected: boolean) {
  return cn(
    checkout.tabBase,
    selected ? checkout.tabSelected : checkout.tabUnselected,
  );
}

export function appButtonClass(
  variant: keyof typeof appBtn | "primary" | "secondary" | "ghost" | "ghostIcon",
  extra?: string,
) {
  const key =
    variant === "primary"
      ? "primary"
      : variant === "secondary"
        ? "secondary"
        : variant === "ghost"
          ? "ghost"
          : variant === "ghostIcon"
            ? "ghostIcon"
            : variant;
  return cn(appBtn[key], extra);
}
