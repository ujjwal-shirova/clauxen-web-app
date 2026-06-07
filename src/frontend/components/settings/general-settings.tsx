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
  const selectedAccent = accentColors.find((c) => c.name === accentColor) ?? accentColors[0];

  return (
    <div className="flex animate-in fade-in flex-col gap-6 duration-300 text-zinc-900">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <div className="flex flex-col">
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

        <SettingsToggleRow
          label={<span className="font-medium">Enable Dictation</span>}
          description="Use dictation in the chat composer."
          checked={dictationEnabled}
          onCheckedChange={setDictationEnabled}
        />

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
          label={<span className="font-medium">Separate Voice</span>}
          description="Keep Clauxen Voice in a separate full screen, without real time transcripts and visuals."
          checked={voiceIsolation}
          onCheckedChange={setVoiceIsolation}
          borderless
        />
      </div>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
        <h3 className="text-[14px] font-semibold text-zinc-700">Display preferences</h3>
        <p className="text-[12px] leading-4 text-zinc-400">
          Additional Clauxen display options not shown in the compact General list.
        </p>

        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-[430] text-zinc-700">Color mode</p>
          <div className="flex gap-4">
            {["Light", "Auto", "Dark"].map((mode) => (
              <div key={mode} className="flex flex-1 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setColorMode(mode)}
                  className={cn(
                    "aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200 shadow-sm transition-all hover:scale-[1.02]",
                    colorMode.toLowerCase() === mode.toLowerCase() &&
                      "border-[#1b67b2] ring-1 ring-[#1b67b2]",
                  )}
                >
                  <div
                    className={cn(
                      "h-full w-full",
                      mode === "Light"
                        ? "bg-white"
                        : mode === "Dark"
                          ? "bg-gray-900"
                          : "bg-gradient-to-br from-white to-gray-900",
                    )}
                  />
                </button>
                <span className="text-[14px] text-zinc-700">{mode}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-[430] text-zinc-700">Chat font</p>
          <div className="flex gap-4">
            {fontThemes.map((theme) => (
              <div key={theme.name} className="flex flex-1 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatFont(theme.name)}
                  className={cn(
                    "flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:scale-[1.02]",
                    chatFont === theme.name && "border-[#1b67b2] ring-1 ring-[#1b67b2]",
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
                <span className="text-center text-[14px] leading-tight text-zinc-700">
                  {theme.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
