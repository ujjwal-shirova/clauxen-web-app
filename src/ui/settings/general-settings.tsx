"use client";

import { useMemo } from "react";
import { ChevronRight } from "@/components/ui/bootstrap-icon";
import { cn } from "@/lib/utils";
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
  SHORTCUT_CATEGORY_ORDER,
  type KeyboardShortcutCategory,
} from "@/lib/keyboard-shortcuts-defaults";
import { ShortcutRecorder } from "@/components/keyboard/shortcut-recorder";
import { Switch } from "@/components/ui/switch";

const appearanceModes = ["System", "Light", "Dark"] as const;

function AppearanceModePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="settings-theme-options"
    >
      {appearanceModes.map((mode, index) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          aria-label={mode}
          tabIndex={value === mode ? 0 : -1}
          className={cn(
            "settings-theme-option",
            value === mode && "is-selected",
          )}
          onClick={() => onChange(mode)}
          onKeyDown={(event) => {
            const direction =
              event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!direction && event.key !== "Home" && event.key !== "End")
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? appearanceModes.length - 1
                  : (index + direction + appearanceModes.length) %
                    appearanceModes.length;
            onChange(appearanceModes[next]);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>("button")
              [next]?.focus();
          }}
        >
          <span
            className={cn(
              "settings-theme-preview",
              `settings-theme-preview--${mode.toLowerCase()}`,
            )}
            aria-hidden
          >
            <span className="settings-theme-preview-rail">
              <i />
              <i />
              <i />
            </span>
            <span className="settings-theme-preview-content">
              <i />
              <i />
              <i />
              <span />
            </span>
          </span>
          <span className="settings-theme-option-label">{mode}</span>
        </button>
      ))}
    </div>
  );
}

interface GeneralSettingsProps {
  section?: "General" | "Appearance" | "Keyboard";
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
  section = "General",
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

  const groupedShortcuts = useMemo(() => {
    const groups = new Map<KeyboardShortcutCategory, typeof shortcuts>();
    for (const shortcut of shortcuts) {
      const category = shortcut.category ?? "General";
      const list = groups.get(category) ?? [];
      list.push(shortcut);
      groups.set(category, list);
    }
    return SHORTCUT_CATEGORY_ORDER.map((category) => ({
      category,
      items: groups.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [shortcuts]);

  return (
    <SettingsPage>
      <SettingsPanelTitle>{section}</SettingsPanelTitle>

      {section === "Appearance" ? (
        <>
          <SettingsSection title="Visual style">
            <SettingsRow label="Mode" borderless>
              <AppearanceModePicker
                value={
                  appearanceModes.includes(
                    appearancePreset as (typeof appearanceModes)[number],
                  )
                    ? appearancePreset
                    : "System"
                }
                onChange={onAppearanceChange}
              />
            </SettingsRow>
          </SettingsSection>
          <SettingsSection title="Theme">
            <SettingsRow
              label="Chat font"
              description="The typeface used in your conversations."
            >
              <SettingsOptionPicker
                value={chatFontValue}
                options={chatFontOptions}
                onValueChange={(value) =>
                  setChatFont(normalizeChatFontId(value))
                }
                aria-label={`Chat font: ${selectedChatFont.label}`}
              />
            </SettingsRow>
            <SettingsRow
              label="Accent color"
              description="Links, focus rings, and selected controls."
            >
              <SettingsOptionPicker
                value={accentValue}
                options={accentOptionItems}
                onValueChange={(value) =>
                  setAccentColor(normalizeAccentId(value))
                }
                aria-label={`Accent color: ${accentValue}`}
              />
            </SettingsRow>
          </SettingsSection>
          <details className="settings-advanced">
            <summary className="settings-disclosure">
              Advanced{" "}
              <ChevronRight
                className="settings-disclosure-chevron size-4"
                aria-hidden
              />
            </summary>
            <div className="mt-4">
              <SettingsSection title="Accessibility">
                <SettingsRow
                  label="Contrast"
                  description="Follow your system setting or increase contrast."
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
                <SettingsRow
                  label="Motion"
                  description="Reduce animations or follow your system setting."
                >
                  <SettingsOptionPicker
                    value={motion}
                    options={motionOptions}
                    onValueChange={setMotion}
                    aria-label="Motion"
                  />
                </SettingsRow>
              </SettingsSection>
            </div>
          </details>
        </>
      ) : null}

      {section === "General" ? (
        <SettingsSection title="Conversations">
          <SettingsToggleRow
            label="Follow-up suggestions"
            description="Show suggested next steps at the end of replies."
            checked={followUpSuggestions}
            onCheckedChange={setFollowUpSuggestions}
          />
        </SettingsSection>
      ) : null}

      {section === "Keyboard" ? (
        <>
          <p className="text-[14px] leading-5 text-[var(--settings-fg-muted)]">
            Select a key combination and press new keys to change a shortcut.
          </p>
          {groupedShortcuts.map((group) => (
            <SettingsSection key={group.category} title={group.category}>
              {group.items.map((shortcut) => (
                <SettingsRow key={shortcut.id} label={shortcut.label}>
                  <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                    <Switch
                      checked={shortcut.enabled}
                      onCheckedChange={(enabled) =>
                        updateShortcut(shortcut.id, { enabled })
                      }
                      aria-label={`Enable ${shortcut.label}`}
                      className="settings-switch"
                    />
                    <ShortcutRecorder
                      keys={shortcut.keys}
                      label={shortcut.label}
                      onChange={(keys) => updateShortcut(shortcut.id, { keys })}
                    />
                  </div>
                </SettingsRow>
              ))}
            </SettingsSection>
          ))}
          <div>
            <SettingsButton
              disabled={!hasShortcutChanges}
              onClick={resetToDefaults}
            >
              Restore defaults
            </SettingsButton>
          </div>
        </>
      ) : null}
    </SettingsPage>
  );
}
