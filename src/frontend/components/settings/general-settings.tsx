"use client";

import { cn } from "@/frontend/lib/utils";
import {
  accentColors,
  appearanceOptions,
  contrastOptions,
  fontThemes,
  voiceOptions,
} from "./constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsSectionHeading,
  SettingsToggleRow,
  SettingsVoiceControl,
} from "./settings-ui";

interface GeneralSettingsProps {
  colorMode: string;
  setColorMode: (value: string) => void;
  chatFont: string;
  setChatFont: (value: string) => void;
  appearancePreset: string;
  contrastMode: string;
  accentColor: string;
  language: string;
  spokenLanguage: string;
  voice: string;
  voiceIsolation: boolean;
  dictationEnabled: boolean;
  setAppearancePreset: (value: string) => void;
  setContrastMode: (value: string) => void;
  setAccentColor: (value: string) => void;
  setLanguage: (value: string) => void;
  setSpokenLanguage: (value: string) => void;
  setVoice: (value: string) => void;
  setVoiceIsolation: (value: boolean) => void;
  setDictationEnabled: (value: boolean) => void;
}

const languageOptions = [
  "Auto-detect",
  "English",
  "Hindi",
  "Spanish",
  "French",
] as const;

export function GeneralSettings({
  colorMode,
  setColorMode,
  chatFont,
  setChatFont,
  appearancePreset,
  contrastMode,
  accentColor,
  language,
  spokenLanguage,
  voice,
  voiceIsolation,
  dictationEnabled,
  setAppearancePreset,
  setContrastMode,
  setAccentColor,
  setLanguage,
  setSpokenLanguage,
  setVoice,
  setVoiceIsolation,
  setDictationEnabled,
}: GeneralSettingsProps) {
  const selectedAccent =
    accentColors.find((c) => c.name === accentColor) ?? accentColors[0];

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection title="Preferences">
        <SettingsRow label="Appearance">
          <SettingsOptionPicker
            value={appearancePreset}
            options={appearanceOptions}
            onValueChange={setAppearancePreset}
          />
        </SettingsRow>

        <SettingsRow label="Contrast">
          <SettingsOptionPicker
            value={contrastMode}
            options={contrastOptions}
            onValueChange={setContrastMode}
          />
        </SettingsRow>

        <SettingsRow label="Accent color">
          <SettingsOptionPicker
            value={accentColor}
            options={accentColors.map((color) => ({
              value: color.name,
              label: color.name,
              leading: (
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color.value }}
                />
              ),
            }))}
            onValueChange={setAccentColor}
            leading={
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: selectedAccent.value }}
              />
            }
          />
        </SettingsRow>

        <SettingsRow label="Language">
          <SettingsOptionPicker
            value={language}
            options={languageOptions}
            onValueChange={setLanguage}
          />
        </SettingsRow>

        <SettingsRow label="Chat font">
          <SettingsOptionPicker
            value={chatFont}
            options={fontThemes.map((theme) => theme.name)}
            onValueChange={setChatFont}
          />
        </SettingsRow>

        <SettingsToggleRow
          label="Enable Dictation"
          description="Use dictation in the chat composer."
          checked={dictationEnabled}
          onCheckedChange={setDictationEnabled}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Voice">
        <SettingsRow
          label="Spoken language"
          description="For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection."
        >
          <SettingsOptionPicker
            value={spokenLanguage}
            options={languageOptions}
            onValueChange={setSpokenLanguage}
          />
        </SettingsRow>

        <SettingsRow label="Voice" borderless>
          <SettingsVoiceControl
            voice={voice}
            voices={voiceOptions}
            onVoiceChange={setVoice}
          />
        </SettingsRow>

        <SettingsToggleRow
          label="Separate Voice"
          description="Keep Clauxen Voice in a separate full screen, without real time transcripts and visuals."
          checked={voiceIsolation}
          onCheckedChange={setVoiceIsolation}
          borderless
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionHeading>Display preferences</SettingsSectionHeading>
        <p className="mb-4 text-[14px] leading-5 text-zinc-500">
          Additional Clauxen display options.
        </p>

        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-zinc-900">Color mode</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {["Light", "Auto", "Dark"].map((mode) => (
              <div
                key={mode}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setColorMode(mode)}
                  className={cn(
                    "aspect-[4/3] w-full overflow-hidden rounded-lg border border-[rgba(11,11,11,0.1)] shadow-sm transition-all hover:scale-[1.02]",
                    colorMode.toLowerCase() === mode.toLowerCase() &&
                      "border-zinc-800 ring-1 ring-zinc-800",
                  )}
                >
                  <div
                    className={cn(
                      "h-full w-full",
                      mode === "Light"
                        ? "bg-white"
                        : mode === "Dark"
                          ? "bg-zinc-900"
                          : "bg-gradient-to-br from-white to-zinc-900",
                    )}
                  />
                </button>
                <span className="text-[14px] text-zinc-600">{mode}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <p className="text-[14px] text-zinc-900">Chat font preview</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {fontThemes.map((theme) => (
              <div
                key={theme.name}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setChatFont(theme.name)}
                  className={cn(
                    "flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-[rgba(11,11,11,0.1)] bg-white shadow-sm transition-all hover:scale-[1.02]",
                    chatFont === theme.name &&
                      "border-zinc-800 ring-1 ring-zinc-800",
                  )}
                >
                  <span
                    className={cn(
                      "text-[24px]",
                      theme.serif ? "font-serif" : "font-sans",
                      theme.dyslexic && "italic",
                    )}
                  >
                    Aa
                  </span>
                </button>
                <span className="text-center text-[14px] leading-tight text-zinc-600">
                  {theme.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
