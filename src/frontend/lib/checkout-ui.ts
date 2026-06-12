import { cn } from "@/frontend/lib/utils";

/** Shared checkout field styles — Stripe-like inputs aligned with billing page accents. */
const fieldBase =
  "w-full rounded-[5px] border border-solid border-[#e0e0e0] bg-white px-3 py-3 text-base leading-[18.4px] text-[#121212] shadow-[0_1px_1px_0_rgba(0,0,0,0.03),0_3px_6px_0_rgba(0,0,0,0.02)] transition-[background,border,box-shadow,color] duration-150 ease-in-out placeholder:text-[#6d6e78] focus:outline-none";

const fieldFocus =
  "focus:border-[#0570de] focus:shadow-[0_1px_1px_0_rgba(0,0,0,0.08),0_3px_6px_0_rgba(0,0,0,0.02),0_0_0_3px_rgba(5,115,225,0.25)]";

export const checkoutUi = {
  form: "w-full max-w-[486px] font-sans text-base leading-[18.4px] text-[#121212]",
  stack: "flex flex-col gap-6",
  section: "flex flex-col gap-4",

  field: cn(fieldBase, fieldFocus),
  fieldWithIcons: cn(fieldBase, fieldFocus, "pr-[9.5rem]"),
  fieldWithTrailingIcon: cn(fieldBase, fieldFocus, "pr-10"),

  sectionTitle: "px-2 text-lg font-medium text-[#121212]",
  panel:
    "rounded-[8px] border border-black/10 bg-white px-4 py-3 shadow-[0_1px_1px_0_rgba(0,0,0,0.03)]",
  panelMuted:
    "rounded-[8px] border border-black/10 bg-white px-4 py-5 text-center text-sm text-zinc-500 shadow-[0_1px_1px_0_rgba(0,0,0,0.03)]",

  tabBase:
    "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[8px] border px-2 py-3 text-sm font-medium transition-all duration-150",
  tabSelected: "border-[#2C84DB] bg-[#D3E5F8] text-zinc-900",
  tabUnselected:
    "border-zinc-200 bg-white text-zinc-700 hover:border-black/30",

  expressButton:
    "flex h-[52px] w-full items-center justify-center gap-2 rounded-[8px] border border-black bg-black text-[15px] font-medium text-white shadow-[0_1px_1px_0_rgba(0,0,0,0.08)] transition-[opacity,box-shadow] duration-150 hover:opacity-90",

  iconButton:
    "flex h-8 w-8 items-center justify-center rounded-[5px] border border-transparent text-zinc-500 transition-colors duration-150 hover:border-black/10 hover:bg-black/[0.03]",

  checkbox:
    "h-4 w-4 shrink-0 rounded-[2px] border border-black/10 accent-[#2C84DB]",
  labelMuted: "text-sm leading-5 text-zinc-600",
  labelFine: "text-xs leading-relaxed text-zinc-500",
  errorText: "text-[14px] leading-[20px] text-[#DF1B41]",

  payDisabled:
    "h-11 w-full cursor-not-allowed rounded-[8px] border border-zinc-200 bg-zinc-300 text-base font-medium text-white",

  hint:
    "flex items-center rounded-[8px] border border-black/10 bg-white px-4 py-3 text-sm leading-[20.3px] text-[#505B71] shadow-[0_1px_1px_0_rgba(0,0,0,0.03)]",

  errorBanner:
    "mb-4 flex items-center rounded-[8px] border border-[#FF8583] bg-[#FFE1E0] px-3 py-2 text-[13px] leading-[19.5px] text-[#911E1B]",

  orLine: "h-px flex-1 bg-black/10",
  orLabel: "px-1 text-xs font-medium text-zinc-500",
} as const;

export function checkoutTabClass(selected: boolean) {
  return cn(
    checkoutUi.tabBase,
    selected ? checkoutUi.tabSelected : checkoutUi.tabUnselected,
  );
}
