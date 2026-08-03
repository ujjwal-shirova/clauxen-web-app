"use client";

import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutKeys,
  parseShortcutKeys,
  type KeyboardShortcutId,
} from "@/lib/keyboard-shortcuts-defaults";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { SettingsPanelTitle } from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";

type ShortcutRowProps = {
  label: string;
  enabled: boolean;
  keys: string[];
  position: "first" | "middle" | "last" | "only";
  onToggleEnabled: (enabled: boolean) => void;
  onEditKeys: () => void;
};

function ShortcutRow({
  label,
  enabled,
  keys,
  position,
  onToggleEnabled,
  onEditKeys,
}: ShortcutRowProps) {
  return (
    <li
      className={cn(
        "flex min-h-[53px] list-none items-center gap-2 bg-[#e8e8e8] px-4 py-2.5",
        position === "first" && "rounded-t-[28px] rounded-b",
        position === "middle" && "rounded",
        position === "last" && "rounded-b-[28px] rounded-t",
        position === "only" && "rounded",
      )}
    >
      <Switch
        checked={enabled}
        onCheckedChange={onToggleEnabled}
        aria-label={`${label}, ${enabled ? "on" : "off"}`}
      />
      <span className="min-w-0 flex-1 truncate text-[14px] tracking-[0.16px]">
        {label}
      </span>
      <button
        type="button"
        onClick={onEditKeys}
        className="flex h-9 min-w-[54px] shrink-0 items-center justify-center rounded-full px-3 text-[13px] text-zinc-600 transition-colors hover:bg-white/60"
        aria-label={`Change shortcut for ${label}`}
      >
        <span className="whitespace-pre font-normal">
          {formatShortcutKeys(keys)}
        </span>
      </button>
    </li>
  );
}

function rowPosition(
  index: number,
  total: number,
): ShortcutRowProps["position"] {
  if (total === 1) return "only";
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
}

function shortcutsEqual(
  a: typeof DEFAULT_KEYBOARD_SHORTCUTS,
  b: typeof DEFAULT_KEYBOARD_SHORTCUTS,
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function KeyboardSettings() {
  const { shortcuts, updateShortcut, resetToDefaults } = useKeyboardShortcuts();

  const hasChanges = useMemo(
    () => !shortcutsEqual(shortcuts, DEFAULT_KEYBOARD_SHORTCUTS),
    [shortcuts],
  );

  const editKeys = (id: KeyboardShortcutId, label: string, keys: string[]) => {
    const next = window.prompt(
      `Enter keys for "${label}" (e.g. ⇧⌘O or meta shift o)`,
      formatShortcutKeys(keys),
    );
    if (next === null) return;
    updateShortcut(id, { keys: parseShortcutKeys(next) });
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Keyboard</SettingsPanelTitle>

      <div className="-mx-4 mt-2 flex flex-col">
        <p className="mb-6 px-6 text-[14px] leading-relaxed tracking-[0.14px] text-zinc-600">
          To change a shortcut, select the key combination, and then type the
          new keys.
        </p>

        <section className="mb-8">
          <h3 className="sticky top-0 z-10 bg-white px-6 py-1 text-sm font-semibold tracking-[0.14px] text-zinc-600">
            App
          </h3>
          <ul className="flex flex-col gap-0.5 px-3">
            {shortcuts.map((s, index) => (
              <ShortcutRow
                key={s.id}
                label={s.label}
                enabled={s.enabled}
                keys={s.keys}
                position={rowPosition(index, shortcuts.length)}
                onToggleEnabled={(enabled) => updateShortcut(s.id, { enabled })}
                onEditKeys={() => editKeys(s.id, s.label, s.keys)}
              />
            ))}
          </ul>
        </section>

        <div className="sticky bottom-0 z-20 border-t border-zinc-200 bg-white px-3 py-3">
          <button
            type="button"
            disabled={!hasChanges}
            className={cn(
              "ml-auto block rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity",
              hasChanges
                ? "no-hover-overlay bg-zinc-900 hover:bg-zinc-800"
                : "cursor-not-allowed bg-zinc-900 opacity-50",
            )}
            onClick={resetToDefaults}
          >
            Restore defaults
          </button>
        </div>
      </div>
    </div>
  );
}
