"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  type KeyboardShortcut,
  type KeyboardShortcutId,
} from "@/lib/keyboard-shortcuts-defaults";

/**
 * Module-level store so every consumer (global keyboard engine, button hints,
 * settings) stays in sync when a shortcut is edited.
 */
let store: KeyboardShortcut[] = DEFAULT_KEYBOARD_SHORTCUTS;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): KeyboardShortcut[] {
  return store;
}

function mergeWithDefaults(parsed: KeyboardShortcut[]): KeyboardShortcut[] {
  // Stored lists can predate new defaults — keep user overrides but surface
  // every known shortcut exactly once.
  const byId = new Map(parsed.map((entry) => [entry.id, entry]));
  return DEFAULT_KEYBOARD_SHORTCUTS.map(
    (fallback) => byId.get(fallback.id) ?? fallback,
  );
}

function loadStored(): KeyboardShortcut[] {
  if (typeof window === "undefined") return DEFAULT_KEYBOARD_SHORTCUTS;
  try {
    const raw = localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    if (!raw) return DEFAULT_KEYBOARD_SHORTCUTS;
    const parsed = JSON.parse(raw) as KeyboardShortcut[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_KEYBOARD_SHORTCUTS;
    }
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_KEYBOARD_SHORTCUTS;
  }
}

function persistStore(next: KeyboardShortcut[]) {
  store = next;
  try {
    localStorage.setItem(
      KEYBOARD_SHORTCUTS_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // ignore quota errors
  }
  emit();
}

/** Hydrate the store from localStorage once on the client. */
function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  const loaded = loadStored();
  store = loaded;
}

export function useKeyboardShortcuts() {
  const shortcuts = useSyncExternalStore(subscribe, getSnapshot, () =>
    DEFAULT_KEYBOARD_SHORTCUTS,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureHydrated();
    emit();
    setReady(true);
  }, []);

  const updateShortcut = useCallback(
    (
      id: KeyboardShortcutId,
      patch: Partial<Pick<KeyboardShortcut, "enabled" | "keys">>,
    ) => {
      ensureHydrated();
      persistStore(
        store.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    persistStore([...DEFAULT_KEYBOARD_SHORTCUTS]);
  }, []);

  return { shortcuts: ready ? shortcuts : DEFAULT_KEYBOARD_SHORTCUTS, updateShortcut, resetToDefaults };
}

export type ShortcutDisplay = {
  keys: string[];
  extraKeys?: string[];
  enabled: boolean;
  label: string;
};

/**
 * Display info for one shortcut, following the user's remapped bindings.
 * Returns `null` on the server / before hydration so hints render after mount.
 */
export function useShortcutDisplay(
  id: KeyboardShortcutId | undefined,
): ShortcutDisplay | null {
  const shortcuts = useSyncExternalStore(subscribe, getSnapshot, () =>
    DEFAULT_KEYBOARD_SHORTCUTS,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureHydrated();
    setReady(true);
  }, []);

  if (!id || !ready) return null;
  const shortcut = shortcuts.find((s) => s.id === id);
  if (!shortcut) return null;
  return {
    keys: shortcut.keys,
    extraKeys: shortcut.extraKeys,
    enabled: shortcut.enabled,
    label: shortcut.label,
  };
}

/** Non-reactive lookup used inside event handlers (engine). */
export function getShortcutBinding(
  id: KeyboardShortcutId,
): KeyboardShortcut | undefined {
  ensureHydrated();
  return store.find((s) => s.id === id);
}
