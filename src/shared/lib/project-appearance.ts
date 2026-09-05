/** Shared project icon + color tokens used by the picker, cards, and avatars. */

export const DEFAULT_PROJECT_ICON = "📁";
export const DEFAULT_PROJECT_COLOR = "#4f46e5";

export const PROJECT_ICONS = [
  "📁",
  "💡",
  "🧠",
  "📝",
  "💻",
  "📚",
  "🎨",
  "🔬",
  "🚀",
  "📈",
  "🎓",
  "🛡️",
  "🧪",
  "💬",
  "🌱",
  "🌍",
  "🤖",
  "💰",
  "🎯",
  "🧩",
  "⚡",
  "🌈",
  "📰",
  "👀",
  "✅",
  "🗂️",
  "📌",
  "🔭",
  "🎮",
  "🎵",
  "🏗️",
  "🏆",
  "❤️",
  "💜",
  "💚",
  "🖤",
] as const;

export type ProjectIcon = (typeof PROJECT_ICONS)[number];

export const PROJECT_COLORS = [
  "#18181b",
  "#3f3f46",
  "#b45309",
  "#c2410c",
  "#b91c1c",
  "#be185d",
  "#7e22ce",
  "#4f46e5",
  "#1d4ed8",
  "#0369a1",
  "#0f766e",
  "#15803d",
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

const PROJECT_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

export function isProjectColorHex(value: string | null | undefined): boolean {
  return Boolean(value && PROJECT_COLOR_HEX.test(value));
}

export function resolveProjectIcon(icon: string | null | undefined): string {
  const trimmed = icon?.trim();
  return trimmed || DEFAULT_PROJECT_ICON;
}

export function resolveProjectColor(color: string | null | undefined): string {
  if (color && PROJECT_COLOR_HEX.test(color)) return color;
  return DEFAULT_PROJECT_COLOR;
}

/** Darken a hex fill so the avatar ring reads as a boundary, not a second fill. */
export function projectBoundaryColor(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "rgba(0,0,0,0.22)";
  const r = Math.max(0, Math.round(parseInt(raw.slice(0, 2), 16) * 0.72));
  const g = Math.max(0, Math.round(parseInt(raw.slice(2, 4), 16) * 0.72));
  const b = Math.max(0, Math.round(parseInt(raw.slice(4, 6), 16) * 0.72));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
