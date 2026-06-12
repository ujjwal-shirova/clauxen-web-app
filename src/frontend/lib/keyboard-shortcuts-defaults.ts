export type KeyboardShortcutId =
  | "openNewChat"
  | "showShortcuts"
  | "searchChats"
  | "toggleDevMode"
  | "toggleSidebar"
  | "setCustomInstructions"
  | "copyLastCodeBlock"
  | "deleteChat";

export type KeyboardShortcut = {
  id: KeyboardShortcutId;
  label: string;
  enabled: boolean;
  keys: string[];
};

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: "openNewChat",
    label: "Open new chat",
    enabled: true,
    keys: ["Shift", "meta", "O"],
  },
  {
    id: "showShortcuts",
    label: "Show shortcuts",
    enabled: true,
    keys: ["meta", "/"],
  },
  {
    id: "searchChats",
    label: "Search chats",
    enabled: true,
    keys: ["meta", "K"],
  },
  {
    id: "toggleDevMode",
    label: "Toggle dev mode",
    enabled: true,
    keys: ["meta", "."],
  },
  {
    id: "toggleSidebar",
    label: "Toggle sidebar",
    enabled: true,
    keys: ["Shift", "meta", "S"],
  },
  {
    id: "setCustomInstructions",
    label: "Set custom instructions",
    enabled: true,
    keys: ["Shift", "meta", "I"],
  },
  {
    id: "copyLastCodeBlock",
    label: "Copy last code block",
    enabled: true,
    keys: ["Shift", "meta", ";"],
  },
  {
    id: "deleteChat",
    label: "Delete chat",
    enabled: true,
    keys: ["Shift", "meta", "Backspace"],
  },
];

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = "clauxen.keyboardShortcuts.v1";

export function formatShortcutKeys(keys: string[]): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  return keys
    .map((key) => {
      if (key === "meta") return isMac ? "⌘" : "Ctrl";
      if (key === "Shift") return "⇧";
      if (key === "Alt") return isMac ? "⌥" : "Alt";
      if (key === "Backspace") return "⌫";
      if (key === "Delete") return "⌦";
      if (key === "/") return "/";
      if (key === ";") return ";";
      if (key === ".") return ".";
      if (key === "O") return "O";
      if (key === "K") return "K";
      if (key === "I") return "I";
      if (key === "S") return "S";
      return key.length === 1 ? key.toUpperCase() : key;
    })
    .join(isMac && keys.includes("meta") && keys.length > 1 ? "" : " ");
}

export function parseShortcutKeys(display: string): string[] {
  const parts = display.trim().split(/\s+/).filter(Boolean);
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const result: string[] = [];
  for (const part of parts) {
    if (part === "⌘" || part.toLowerCase() === "cmd") result.push("meta");
    else if (part === "⇧" || part.toLowerCase() === "shift")
      result.push("Shift");
    else if (part === "⌥") result.push("Alt");
    else if (part === "Ctrl" || part === "⌃")
      result.push(isMac ? "meta" : "Control");
    else if (part === "⌫") result.push("Backspace");
    else if (part === "⌦") result.push("Delete");
    else if (part === "/") result.push("/");
    else if (part === ";") result.push(";");
    else if (part === ".") result.push(".");
    else if (part.length === 1) result.push(part.toUpperCase());
    else result.push(part);
  }
  return result;
}
