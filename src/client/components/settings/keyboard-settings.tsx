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
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-ui";

type ShortcutRowProps = {
  label: string;
  enabled: boolean;
  keys: string[];
  borderless?: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onEditKeys: () => void;
};

function ShortcutRow({
  label,
  enabled,
  keys,
  borderless,
  onToggleEnabled,
  onEditKeys,
}: ShortcutRowProps) {
  return (
    <SettingsRow label={label} borderless={borderless}>
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <Switch
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          aria-label={`${label}, ${enabled ? "on" : "off"}`}
          className="settings-switch"
        />
        <button
          type="button"
          onClick={onEditKeys}
          className="settings-btn min-w-[72px] font-mono"
          aria-label={`Change shortcut for ${label}`}
        >
          {formatShortcutKeys(keys)}
        </button>
      </div>
    </SettingsRow>
  );
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
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Keyboard</SettingsPanelTitle>

      <SettingsSection
        title="App shortcuts"
        description="Select a key combination to replace it, or turn off shortcuts you don't use."
      >
        {shortcuts.map((s, index) => (
          <ShortcutRow
            key={s.id}
            label={s.label}
            enabled={s.enabled}
            keys={s.keys}
            borderless={index === shortcuts.length - 1}
            onToggleEnabled={(enabled) => updateShortcut(s.id, { enabled })}
            onEditKeys={() => editKeys(s.id, s.label, s.keys)}
          />
        ))}
      </SettingsSection>

      <div className="flex justify-end">
        <SettingsPillButton disabled={!hasChanges} onClick={resetToDefaults}>
          Restore defaults
        </SettingsPillButton>
      </div>
    </div>
  );
}
