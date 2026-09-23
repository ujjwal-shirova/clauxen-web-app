/** Desktop app sidebar width. Default until the user drags; then stored in settings. */

export const SIDEBAR_WIDTH_DEFAULT = 288;
export const SIDEBAR_WIDTH_MIN = 232;
export const SIDEBAR_WIDTH_MAX = 420;
export const SIDEBAR_WIDTH_STORAGE_KEY = "clauxen.sidebarWidth";
export const SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

export function clampSidebarWidth(value: unknown): number {
  if (value == null || value === "") return SIDEBAR_WIDTH_DEFAULT;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.round(
    Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, numeric)),
  );
}

export function sidebarWidthCss(width: number): string {
  return `${clampSidebarWidth(width)}px`;
}
