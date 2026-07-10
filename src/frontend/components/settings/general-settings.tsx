"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { fontThemes, motionOptions, voiceOptions } from "./constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
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
  motion: string;
  setMotion: (value: string) => void;
  responseCompletions: boolean;
  setResponseCompletions: (value: boolean) => void;
  voiceSpeed?: string;
  setVoiceSpeed?: (value: string) => void;
}

const languageOptions = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "Auto-detect",
] as const;

const voiceSpeedOptions = ["Slower", "Normal", "Faster"] as const;

const appearanceModes = [
  { value: "System", icon: Monitor, label: "System" },
  { value: "Light", icon: Sun, label: "Light" },
  { value: "Dark", icon: Moon, label: "Dark" },
] as const;

function syncColorMode(preset: string): string {
  if (preset === "Light") return "Light";
  if (preset === "Dark") return "Dark";
  return "Auto";
}

export function GeneralSettings({
  chatFont,
  setChatFont,
  appearancePreset,
  language,
  voice,
  setAppearancePreset,
  setColorMode,
  setLanguage,
  setVoice,
  motion,
  setMotion,
  responseCompletions,
  setResponseCompletions,
  voiceSpeed = "Normal",
  setVoiceSpeed,
}: GeneralSettingsProps) {
  const handleAppearance = (preset: string) => {
    setAppearancePreset(preset);
    setColorMode(syncColorMode(preset));
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection title="Preferences">
        <SettingsRow label="Appearance">
          <div className="inline-flex rounded-lg bg-zinc-100/90 p-0.5">
            {appearanceModes.map(({ value, icon: Icon, label }) => {
              const active = appearancePreset === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => handleAppearance(value)}
                  className={cn(
                    "inline-flex h-8 w-9 items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label="Chat font">
          <SettingsOptionPicker
            value={chatFont}
            options={fontThemes.map((theme) => theme.name)}
            onValueChange={setChatFont}
          />
        </SettingsRow>

        <div className="flex min-h-[72px] items-start justify-between gap-4 border-b border-zinc-100 py-3">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[14px] font-medium">Motion</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Reduce animation in streaming responses and other interface
              elements.
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg bg-zinc-100/90 p-0.5">
            {motionOptions.map((option) => {
              const active = motion === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMotion(option)}
                  className={cn(
                    "h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Voice">
        <SettingsRow label="Language">
          <SettingsOptionPicker
            value={
              languageOptions.includes(
                language as (typeof languageOptions)[number],
              )
                ? language
                : "English"
            }
            options={languageOptions}
            onValueChange={setLanguage}
          />
        </SettingsRow>

        <SettingsRow label="Style">
          <SettingsOptionPicker
            value={voice}
            options={voiceOptions}
            onValueChange={setVoice}
          />
        </SettingsRow>

        <SettingsRow label="Speed" borderless>
          <SettingsOptionPicker
            value={voiceSpeed}
            options={voiceSpeedOptions}
            onValueChange={(v) => setVoiceSpeed?.(v)}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsToggleRow
          label="Response completions"
          description="Get notified when Clauxen has finished a response. Useful for long-running tasks."
          checked={responseCompletions}
          onCheckedChange={setResponseCompletions}
          borderless
        />
      </SettingsSection>
    </div>
  );
}
