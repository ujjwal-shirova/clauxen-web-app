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
    "app-page-surface flex h-full w-full flex-1 flex-col overflow-hidden font-sans text-[var(--settings-fg)] dark:text-zinc-50",
  headerBleed:
    "w-full shrink-0 border-b border-[var(--ui-border-subtle)] dark:border-white/[0.06]",
  headerInner:
    "mobile-page-inset mx-auto w-full max-w-[var(--ui-page-max-width,880px)] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-4 sm:pt-5",
  title: "app-page-title",
  titleWide: "app-page-title",
  subtitle: "app-page-subtitle",
  searchWrap: "relative mt-3 sm:mt-4",
  searchIcon:
    "pointer-events-none absolute left-2.5 top-1/2 icon-sm -translate-y-1/2 text-[var(--settings-fg-muted)]",
  searchInput: "app-page-search",
  primaryCta: cn(appBtn.primary, "shrink-0 gap-1.5 shadow-none"),
  outlineCta: cn(appBtn.secondary, "shrink-0"),
  emptyIconWell:
    "mb-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--settings-card-bg)] text-[var(--settings-fg-muted)] shadow-[var(--settings-card-shadow)]",
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
    "app-surface-panel fixed z-[201] flex min-h-0 flex-col overflow-hidden inset-0 h-[100dvh] w-full md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(740px,calc(100dvh-2rem))] md:w-[min(1040px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[18px] md:border md:border-[var(--settings-modal-border,var(--ui-border))] md:shadow-[var(--settings-modal-shadow,var(--popup-shadow))]",
} as const;

const field = {
  base: "app-field",
  withIcons: "app-field app-field--icons",
  withTrailing: "app-field app-field--trailing",
  withPrefix: "app-field app-field--prefix",
  withLeadingIcon: "app-field app-field--leading-icon",
  withCombo: "app-field app-field--combo",
  mutedPanel: "app-field-muted-panel",
} as const;

const checkout = {
  form: "w-full font-sans text-[var(--settings-fg)]",
  stack: "flex flex-col gap-8",
  section: "flex flex-col gap-4",

  field: field.base,
  fieldWithIcons: field.withIcons,
  fieldWithTrailingIcon: field.withTrailing,
  fieldWithPrefix: field.withPrefix,
  fieldWithLeadingIcon: field.withLeadingIcon,
  fieldWithCombo: field.withCombo,

  sectionTitle: "text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--settings-fg)]",
  sectionHint: "text-[13px] leading-5 text-[var(--settings-fg-muted)]",
  panel: "rounded-xl bg-[var(--settings-icon-bg)] px-4 py-3",
  panelMuted: field.mutedPanel,

  fieldLabel: "mb-1.5 text-[12px] font-medium leading-4 text-[var(--settings-fg-muted)]",

  tabBase:
    "checkout-segment__item no-hover-overlay no-hover",
  tabSelected: "",
  tabUnselected: "",

  expressButton: cn(appBtn.primaryLg, "w-full gap-2"),

  iconButton:
    "ui-icon-button border border-transparent text-[var(--settings-fg-muted)] hover:bg-[var(--ui-hover-wash)]",

  checkbox:
    "mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--settings-input-border)] accent-[hsl(var(--brand))]",
  labelMuted: page.muted,
  labelFine: "text-[13px] leading-5 text-[var(--settings-fg-muted)]",
  errorText: "text-[13px] leading-5 text-[var(--settings-danger)]",

  payDisabled: cn(appBtn.primaryLg, "w-full cursor-not-allowed opacity-50"),

  hint: "flex items-center gap-3 rounded-xl bg-[var(--settings-icon-bg)] px-3.5 py-2.5 text-[13px] leading-5 text-[var(--settings-fg-muted)]",

  errorBanner: "app-banner app-banner--danger mb-5",

  successBanner: "app-banner app-banner--success mb-4",

  warningBanner: "app-banner app-banner--warning mb-4",

  infoBanner: "app-banner app-banner--info mb-4",

  orLine: "h-px flex-1 bg-[var(--settings-hairline)]",
  orLabel: "px-1 text-[12px] font-medium text-[var(--settings-fg-muted)]",
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
  variant:
    | keyof typeof appBtn
    | "primary"
    | "secondary"
    | "ghost"
    | "ghostIcon",
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
