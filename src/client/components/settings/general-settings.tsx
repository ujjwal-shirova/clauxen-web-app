"use client";

import { useMemo } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/lib/segmented-control";
import { accentColors, contrastOptions, motionOptions } from "./constants";
import {
  SettingsButton,
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
  type SettingsOptionItem,
} from "./settings-ui";
import {
  CHAT_FONT_OPTIONS,
  chatFontOption,
  normalizeAccentId,
  normalizeChatFontId,
  normalizeContrastMode,
} from "@/lib/app-preferences";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutKeys,
  parseShortcutKeys,
  type KeyboardShortcutId,
} from "@/lib/keyboard-shortcuts-defaults";
import { Switch } from "@/components/ui/switch";

const appearanceModes = [
  { value: "System", icon: Monitor, label: "System" },
  { value: "Light", icon: Sun, label: "Light" },
  { value: "Dark", icon: Moon, label: "Dark" },
] as const;

interface GeneralSettingsProps {
  appearancePreset: string;
  /** Single optimistic update — UI theme applies before DB persist. */
  onAppearanceChange: (preset: string) => void;
  chatFont: string;
  setChatFont: (value: string) => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  contrastMode: string;
  setContrastMode: (value: string) => void;
  motion: string;
  setMotion: (value: string) => void;
  followUpSuggestions: boolean;
  setFollowUpSuggestions: (value: boolean) => void;
}

export function GeneralSettings({
  appearancePreset,
  onAppearanceChange,
  chatFont,
  setChatFont,
  accentColor,
  setAccentColor,
  contrastMode,
  setContrastMode,
  motion,
  setMotion,
  followUpSuggestions,
  setFollowUpSuggestions,
}: GeneralSettingsProps) {
  const chatFontOptions: SettingsOptionItem[] = useMemo(
    () =>
      CHAT_FONT_OPTIONS.map((option) => ({
        value: option.id,
        label: option.label,
        labelStyle: {
          fontFamily: option.familyName
            ? `"${option.familyName}", ${option.stack}`
            : option.cssVar
              ? `var(${option.cssVar}), ${option.stack}`
              : option.stack,
        },
      })),
    [],
  );
  const chatFontValue = normalizeChatFontId(chatFont);
  const selectedChatFont = chatFontOption(chatFontValue);

  const accentOptionItems: SettingsOptionItem[] = useMemo(
    () =>
      accentColors.map((swatch) => ({
        value: swatch.name,
        label: swatch.name,
        leading: (
          <span
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/20"
            style={{ backgroundColor: swatch.value }}
            aria-hidden
          />
        ),
      })),
    [],
  );
  const accentValue = normalizeAccentId(accentColor);
  const contrastValue = normalizeContrastMode(contrastMode);

  const { shortcuts, updateShortcut, resetToDefaults } = useKeyboardShortcuts();
  const hasShortcutChanges = useMemo(
    () =>
      JSON.stringify(shortcuts) !== JSON.stringify(DEFAULT_KEYBOARD_SHORTCUTS),
    [shortcuts],
  );

  const editShortcutKeys = (
    id: KeyboardShortcutId,
    label: string,
    keys: string[],
  ) => {
    const next = window.prompt(
      `Keys for "${label}" (e.g. ⇧⌘O)`,
      formatShortcutKeys(keys),
    );
    if (next === null) return;
    updateShortcut(id, { keys: parseShortcutKeys(next) });
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection
        title="Appearance"
        description="Theme, accent, and contrast across the app."
      >
        <SettingsRow label="Theme">
          <div className={segmentedTrackClass} role="radiogroup" aria-label="Theme">
            {appearanceModes.map(({ value, icon: Icon, label }) => {
              const active = appearancePreset === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  onClick={() => onAppearanceChange(value)}
                  className={segmentedOptionClass(active, "icon")}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow
          label="Accent"
          description="Focus rings, links, and selected states."
        >
          <SettingsOptionPicker
            value={accentValue}
            options={accentOptionItems}
            onValueChange={(value) => setAccentColor(normalizeAccentId(value))}
            aria-label={`Accent color: ${accentValue}`}
          />
        </SettingsRow>

        <SettingsRow
          label="Contrast"
          description="System follows your OS setting."
        >
          <SettingsOptionPicker
            value={contrastValue}
            options={contrastOptions}
            onValueChange={(value) =>
              setContrastMode(normalizeContrastMode(value))
            }
            aria-label={`Contrast: ${contrastValue}`}
          />
        </SettingsRow>

        <SettingsRow label="Motion" description="Reduce animation.">
          <div className={cn(segmentedTrackClass, "shrink-0")} role="radiogroup" aria-label="Motion">
            {motionOptions.map((option) => {
              const active = motion === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMotion(option)}
                  className={segmentedOptionClass(active)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Chat"
        description="Type and follow-ups in conversations."
      >
        <SettingsRow label="Chat font">
          <SettingsOptionPicker
            value={chatFontValue}
            options={chatFontOptions}
            onValueChange={(value) => setChatFont(normalizeChatFontId(value))}
            aria-label={`Chat font: ${selectedChatFont.label}`}
          />
        </SettingsRow>

        <SettingsToggleRow
          label="Follow-up suggestions"
          description="End replies with clickable follow-ups."
          checked={followUpSuggestions}
          onCheckedChange={setFollowUpSuggestions}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Shortcuts"
        description="Turn off shortcuts you don't use, or pick new keys."
        action={
          <SettingsButton
            size="sm"
            disabled={!hasShortcutChanges}
            onClick={resetToDefaults}
          >
            Restore defaults
          </SettingsButton>
        }
      >
        {shortcuts.map((shortcut, index) => (
          <SettingsRow
            key={shortcut.id}
            label={shortcut.label}
            borderless={index === shortcuts.length - 1}
          >
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <Switch
                checked={shortcut.enabled}
                onCheckedChange={(enabled) =>
                  updateShortcut(shortcut.id, { enabled })
                }
                aria-label={`${shortcut.label}, ${shortcut.enabled ? "on" : "off"}`}
                className="settings-switch"
              />
              <button
                type="button"
                onClick={() =>
                  editShortcutKeys(shortcut.id, shortcut.label, shortcut.keys)
                }
                className="settings-btn min-w-[72px] font-mono"
                aria-label={`Change shortcut for ${shortcut.label}`}
              >
                {formatShortcutKeys(shortcut.keys)}
              </button>
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>
    </SettingsPage>
  );
}
