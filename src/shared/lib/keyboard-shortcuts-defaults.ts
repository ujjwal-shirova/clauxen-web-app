/**
 * Keyboard shortcut registry — single source of truth for every key binding
 * in the app.
 *
 * - `DEFAULT_KEYBOARD_SHORTCUTS` holds the remappable bindings (persisted to
 *   localStorage, editable in Settings → General → Shortcuts).
 * - `BUILT_IN_SHORTCUTS` holds the fixed navigation / scrolling / composer
 *   bindings that are always on and only listed in the shortcuts help dialog.
 * - `comboMatchesEvent` / `formatShortcutKeys` / `shortcutKeyChips` power the
 *   engine and every hint UI (keycap chips on buttons, black hover hints).
 */

export type KeyboardShortcutId =
  | "openNewChat"
  | "showShortcuts"
  | "searchChats"
  | "toggleDevMode"
  | "toggleSidebar"
  | "setCustomInstructions"
  | "copyLastCodeBlock"
  | "deleteChat"
  | "openSettings"
  | "focusComposer";

export type KeyboardShortcutCategory =
  | "General"
  | "Chat"
  | "Navigation"
  | "Scrolling"
  | "Focus";

export type KeyboardShortcut = {
  id: KeyboardShortcutId;
  label: string;
  category: KeyboardShortcutCategory;
  enabled: boolean;
  keys: string[];
  /** Secondary fixed binding that always works (shown as extra hint). */
  extraKeys?: string[];
};

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: "openNewChat",
    label: "Open new chat",
    category: "General",
    enabled: true,
    keys: ["Shift", "meta", "O"],
  },
  {
    id: "searchChats",
    label: "Search chats",
    category: "General",
    enabled: true,
    keys: ["meta", "K"],
  },
  {
    id: "toggleSidebar",
    label: "Toggle sidebar",
    category: "General",
    enabled: true,
    keys: ["meta", "B"],
    extraKeys: ["Shift", "meta", "S"],
  },
  {
    id: "openSettings",
    label: "Open settings",
    category: "General",
    enabled: true,
    keys: ["meta", ","],
  },
  {
    id: "showShortcuts",
    label: "Show keyboard shortcuts",
    category: "General",
    enabled: true,
    keys: ["meta", "/"],
    extraKeys: ["?"],
  },
  {
    id: "setCustomInstructions",
    label: "Set custom instructions",
    category: "General",
    enabled: true,
    keys: ["Shift", "meta", "I"],
  },
  {
    id: "toggleDevMode",
    label: "Highlight interactive elements",
    category: "General",
    enabled: true,
    keys: ["meta", "."],
  },
  {
    id: "focusComposer",
    label: "Focus message box",
    category: "Chat",
    enabled: true,
    keys: ["/"],
  },
  {
    id: "copyLastCodeBlock",
    label: "Copy last code block",
    category: "Chat",
    enabled: true,
    keys: ["Shift", "meta", ";"],
  },
  {
    id: "deleteChat",
    label: "Delete current chat",
    category: "Chat",
    enabled: true,
    keys: ["Shift", "meta", "Backspace"],
  },
];

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = "clauxen.keyboardShortcuts.v2";

/** Fixed bindings — always active, shown in the shortcuts help dialog. */
export type BuiltInShortcut = {
  category: KeyboardShortcutCategory;
  label: string;
  keys: string[];
  description?: string;
};

export const BUILT_IN_SHORTCUTS: BuiltInShortcut[] = [
  {
    category: "Focus",
    label: "Move to next control",
    keys: ["Tab"],
  },
  {
    category: "Focus",
    label: "Move to previous control",
    keys: ["Shift", "Tab"],
  },
  {
    category: "Focus",
    label: "Activate focused button or link",
    keys: ["Enter"],
  },
  {
    category: "Focus",
    label: "Activate focused button",
    keys: ["Space"],
  },
  {
    category: "Focus",
    label: "Close dialog, menu or overlay",
    keys: ["Escape"],
    description: "Also blurs the message box",
  },
  {
    category: "Navigation",
    label: "Next item in a list",
    keys: ["J"],
  },
  {
    category: "Navigation",
    label: "Previous item in a list",
    keys: ["K"],
  },
  {
    category: "Navigation",
    label: "Go to chats",
    keys: ["G", "C"],
  },
  {
    category: "Navigation",
    label: "Go to Library",
    keys: ["G", "L"],
  },
  {
    category: "Navigation",
    label: "Go to Projects",
    keys: ["G", "P"],
  },
  {
    category: "Navigation",
    label: "Go to My Clauxen",
    keys: ["G", "M"],
  },
  {
    category: "Scrolling",
    label: "Scroll down",
    keys: ["ArrowDown"],
  },
  {
    category: "Scrolling",
    label: "Scroll up",
    keys: ["ArrowUp"],
  },
  {
    category: "Scrolling",
    label: "Scroll one page down",
    keys: ["PageDown"],
  },
  {
    category: "Scrolling",
    label: "Scroll one page up",
    keys: ["PageUp"],
  },
  {
    category: "Scrolling",
    label: "Scroll to top",
    keys: ["Home"],
  },
  {
    category: "Scrolling",
    label: "Scroll to latest",
    keys: ["End"],
  },
  {
    category: "Chat",
    label: "Send message",
    keys: ["Enter"],
  },
  {
    category: "Chat",
    label: "Send message",
    keys: ["meta", "Enter"],
  },
  {
    category: "Chat",
    label: "Insert new line",
    keys: ["Shift", "Enter"],
  },
  {
    category: "Chat",
    label: "Attach files",
    keys: ["meta", "U"],
  },
];

export const SHORTCUT_CATEGORY_ORDER = [
  "General",
  "Chat",
  "Navigation",
  "Scrolling",
  "Focus",
] as const;

/* ------------------------------------------------------------------ */
/* Key token normalization                                              */
/* ------------------------------------------------------------------ */

const MODIFIER_TOKENS = new Set([
  "meta",
  "cmd",
  "command",
  "ctrl",
  "control",
  "alt",
  "option",
  "shift",
]);

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  escape: "escape",
  enter: "enter",
  return: "enter",
  "⏎": "enter",
  "↩": "enter",
  "↵": "enter",
  space: "space",
  spacebar: "space",
  " ": "space",
  backspace: "backspace",
  "⌫": "backspace",
  delete: "delete",
  del: "delete",
  "⌦": "delete",
  tab: "tab",
  "⇥": "tab",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  arrowup: "arrowup",
  "↑": "arrowup",
  arrowdown: "arrowdown",
  "↓": "arrowdown",
  arrowleft: "arrowleft",
  "←": "arrowleft",
  arrowright: "arrowright",
  "→": "arrowright",
  pageup: "pageup",
  pagedown: "pagedown",
  home: "home",
  end: "end",
};

function normalizeKeyToken(token: string): string {
  const lower = token.trim().toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

export function isModifierToken(token: string): boolean {
  return MODIFIER_TOKENS.has(token.trim().toLowerCase());
}

/** Normalize a KeyboardEvent into the registry key token form. */
export function eventKeyToken(event: KeyboardEvent | React.KeyboardEvent): string {
  return normalizeKeyToken(event.key);
}

/* ------------------------------------------------------------------ */
/* Matching                                                             */
/* ------------------------------------------------------------------ */

type Combo = {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

function parseCombo(keys: string[]): Combo | null {
  const combo: Combo = {
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
    key: "",
  };
  for (const raw of keys) {
    const lower = raw.trim().toLowerCase();
    if (lower === "meta" || lower === "cmd" || lower === "command") {
      combo.meta = true;
    } else if (lower === "ctrl" || lower === "control") {
      combo.ctrl = true;
    } else if (lower === "alt" || lower === "option") {
      combo.alt = true;
    } else if (lower === "shift") {
      combo.shift = true;
    } else {
      combo.key = normalizeKeyToken(raw);
    }
  }
  return combo.key ? combo : null;
}

/**
 * True when the combo should enforce an exact Shift match. Single printable
 * punctuation (like `?` which already encodes Shift on most layouts) ignores
 * Shift so `["?"]` matches whether or not Shift is physically held.
 */
function isShiftSensitive(key: string): boolean {
  if (key.length > 1) return true;
  return /^[a-z0-9]$/.test(key);
}

export function comboMatchesEvent(
  keys: string[],
  event: KeyboardEvent | React.KeyboardEvent,
): boolean {
  const combo = parseCombo(keys);
  if (!combo) return false;
  if (eventKeyToken(event) !== combo.key) return false;

  // Accept either physical meta or ctrl for the primary modifier so a single
  // binding works across macOS (⌘) and Windows/Linux (Ctrl).
  const primaryDown = event.metaKey || event.ctrlKey;
  if (combo.meta && !primaryDown) return false;
  if (!combo.meta && combo.ctrl && !(event.ctrlKey && !event.metaKey)) {
    return false;
  }
  if (!combo.meta && !combo.ctrl && primaryDown) return false;
  if (event.altKey !== combo.alt) return false;
  if (isShiftSensitive(combo.key) && event.shiftKey !== combo.shift) return false;
  return true;
}

export function anyComboMatches(
  combos: string[][],
  event: KeyboardEvent | React.KeyboardEvent,
): boolean {
  return combos.some((combo) => comboMatchesEvent(combo, event));
}

/* ------------------------------------------------------------------ */
/* Display                                                              */
/* ------------------------------------------------------------------ */

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

const KEY_SYMBOLS_MAC: Record<string, string> = {
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
  enter: "⏎",
  backspace: "⌫",
  delete: "⌦",
  escape: "Esc",
  tab: "⇥",
  space: "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
};

const KEY_SYMBOLS_WIN: Record<string, string> = {
  meta: "Ctrl",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  enter: "Enter",
  backspace: "Backspace",
  delete: "Delete",
  escape: "Esc",
  tab: "Tab",
  space: "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
};

const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"] as const;

/**
 * Convert a combo (e.g. `["Shift","meta","O"]`) into display chips
 * (e.g. `["⇧","⌘","O"]` on macOS).
 */
export function shortcutKeyChips(keys: string[], mac = isMacPlatform()): string[] {
  const combo = parseCombo(keys);
  if (!combo) return [];
  const symbols = mac ? KEY_SYMBOLS_MAC : KEY_SYMBOLS_WIN;
  const chips: string[] = [];
  for (const modifier of MODIFIER_ORDER) {
    if (modifier === "ctrl" && combo.meta) continue; // meta covers primary
    if (combo[modifier]) chips.push(symbols[modifier] ?? modifier);
  }
  const keySymbol = symbols[combo.key] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key);
  chips.push(keySymbol);
  return chips;
}

/** Plain-text rendering of a combo (settings editor, titles, aria labels). */
export function formatShortcutKeys(keys: string[]): string {
  return shortcutKeyChips(keys).join(isMacPlatform() ? "" : "+");
}

/** Parse display text (e.g. "⇧⌘O") back into a combo. */
export function parseShortcutKeys(display: string): string[] {
  const isMac = isMacPlatform();
  const result: string[] = [];
  const tokens = display.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    for (const ch of token) {
      const lower = ch.toLowerCase();
      if (ch === "⌘" || lower === "cmd") result.push("meta");
      else if (ch === "⇧") result.push("Shift");
      else if (ch === "⌥" || lower === "option") result.push("Alt");
      else if (ch === "⌃") result.push("ctrl");
      else if (ch === "⌫") result.push("Backspace");
      else if (ch === "⌦") result.push("Delete");
      else if (ch === "⏎" || ch === "↩" || ch === "↵") result.push("Enter");
      else if (ch === "⇥") result.push("Tab");
      else if (ch === "↑") result.push("ArrowUp");
      else if (ch === "↓") result.push("ArrowDown");
      else if (ch === "←") result.push("ArrowLeft");
      else if (ch === "→") result.push("ArrowRight");
      else if (lower === "ctrl" || lower === "control") result.push(isMac ? "ctrl" : "meta");
      else if (lower === "shift") result.push("Shift");
      else if (lower === "esc") result.push("Escape");
      else if (ch === " ") result.push("Space");
      else result.push(ch);
    }
  }
  return result;
}

/**
 * Build a combo directly from a KeyboardEvent (used by the shortcut recorder
 * in Settings so users can press the keys they want instead of typing them).
 */
export function comboFromEvent(
  event: KeyboardEvent | React.KeyboardEvent,
): string[] | null {
  const key = eventKeyToken(event);
  if (MODIFIER_TOKENS.has(key)) return null;
  const keys: string[] = [];
  if (event.ctrlKey && !event.metaKey) keys.push("ctrl");
  if (event.metaKey) keys.push("meta");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey && isShiftSensitive(key)) keys.push("Shift");
  keys.push(key.length === 1 ? key.toUpperCase() : key);
  return keys;
}

/** Human label for an aria attribute ("⌘ + Shift + O"). */
export function describeShortcut(keys: string[]): string {
  return shortcutKeyChips(keys, false).join(" + ");
}

/** Remappable shortcuts (defaults) keyed by id. */
export function defaultShortcut(
  id: KeyboardShortcutId,
): KeyboardShortcut | undefined {
  return DEFAULT_KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === id);
}
