"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  type KeyboardShortcut,
  type KeyboardShortcutId,
} from "@/lib/keyboard-shortcuts-defaults";

function loadStored(): KeyboardShortcut[] {
  if (typeof window === "undefined") return DEFAULT_KEYBOARD_SHORTCUTS;
  try {
    const raw = localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    if (!raw) return DEFAULT_KEYBOARD_SHORTCUTS;
    const parsed = JSON.parse(raw) as KeyboardShortcut[];
    if (!Array.isArray(parsed) || parsed.length === 0)
      return DEFAULT_KEYBOARD_SHORTCUTS;
    return parsed;
  } catch {
    return DEFAULT_KEYBOARD_SHORTCUTS;
  }
}

export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(
    DEFAULT_KEYBOARD_SHORTCUTS,
  );

  useEffect(() => {
    setShortcuts(loadStored());
  }, []);

  const persist = useCallback((next: KeyboardShortcut[]) => {
    setShortcuts(next);
    try {
      localStorage.setItem(
        KEYBOARD_SHORTCUTS_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // ignore quota errors
    }
  }, []);

  const updateShortcut = useCallback(
    (
      id: KeyboardShortcutId,
      patch: Partial<Pick<KeyboardShortcut, "enabled" | "keys">>,
    ) => {
      const next = shortcuts.map((s) => (s.id === id ? { ...s, ...patch } : s));
      persist(next);
    },
    [shortcuts, persist],
  );

  const resetToDefaults = useCallback(() => {
    persist([...DEFAULT_KEYBOARD_SHORTCUTS]);
  }, [persist]);

  return { shortcuts, updateShortcut, resetToDefaults };
}
