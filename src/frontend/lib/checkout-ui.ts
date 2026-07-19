import { cn } from "@/frontend/lib/utils";

/**
 * Checkout UI tokens — aligned with the main Clauxen/shirova app shell
 * (zinc surfaces, soft borders, app primary buttons).
 */
const fieldBase =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[15px] leading-5 text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-[background,border,box-shadow,color] duration-150 placeholder:text-zinc-400 focus:outline-none";

const fieldFocus =
  "focus:border-zinc-400 focus:shadow-[0_0_0_3px_rgba(24,24,27,0.06)]";

export const checkoutUi = {
  form: "w-full max-w-[480px] font-sans text-[15px] leading-5 text-zinc-900",
  stack: "flex flex-col gap-6",
  section: "flex flex-col gap-4",

  field: cn(fieldBase, fieldFocus),
  fieldWithIcons: cn(fieldBase, fieldFocus, "pr-28"),
  fieldWithTrailingIcon: cn(fieldBase, fieldFocus, "pr-10"),

  sectionTitle: "px-0.5 text-[15px] font-semibold tracking-[-0.01em] text-zinc-900",
  panel:
    "rounded-2xl border border-zinc-200/90 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(24,24,27,0.03)]",
  panelMuted:
    "rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-5 text-center text-sm text-zinc-500",

  tabBase:
    "flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition-all duration-150",
  tabSelected: "border-zinc-900 bg-zinc-900 text-white",
  tabUnselected:
    "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",

  expressButton:
    "flex h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-900 text-[15px] font-medium text-white transition-opacity duration-150 hover:opacity-90",

  iconButton:
    "flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition-colors duration-150 hover:border-zinc-200 hover:bg-zinc-50",

  checkbox:
    "h-4 w-4 shrink-0 rounded border border-zinc-300 accent-zinc-900",
  labelMuted: "text-sm leading-5 text-zinc-600",
  labelFine: "text-xs leading-relaxed text-zinc-500",
  errorText: "text-[13px] leading-5 text-red-600",

  payDisabled:
    "h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-200 text-base font-medium text-white",

  hint:
    "flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm leading-5 text-zinc-600",

  errorBanner:
    "mb-4 flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-800",

  orLine: "h-px flex-1 bg-zinc-200",
  orLabel: "px-1 text-xs font-medium text-zinc-500",
} as const;

export function checkoutTabClass(selected: boolean) {
  return cn(
    checkoutUi.tabBase,
    selected ? checkoutUi.tabSelected : checkoutUi.tabUnselected,
  );
}
