"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/frontend/lib/segmented-control";
import { fontThemes, motionOptions } from "./constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "./settings-ui";

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

interface GeneralSettingsProps {
  appearancePreset: string;
  setAppearancePreset: (value: string) => void;
  setColorMode: (value: string) => void;
  chatFont: string;
  setChatFont: (value: string) => void;
  motion: string;
  setMotion: (value: string) => void;
  followUpSuggestions: boolean;
  setFollowUpSuggestions: (value: boolean) => void;
}

export function GeneralSettings({
  appearancePreset,
  setAppearancePreset,
  setColorMode,
  chatFont,
  setChatFont,
  motion,
  setMotion,
  followUpSuggestions,
  setFollowUpSuggestions,
}: GeneralSettingsProps) {
  const handleAppearance = (preset: string) => {
    setAppearancePreset(preset);
    setColorMode(syncColorMode(preset));
  };

  const chatFontOptions = fontThemes.map((theme) =>
    theme.name === "Default" ? "Clauxen Serif" : theme.name,
  );
  const chatFontValue = chatFont === "Default" ? "Clauxen Serif" : chatFont;

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection title="Preferences">
        <SettingsRow label="Appearance">
          <div className={segmentedTrackClass}>
            {appearanceModes.map(({ value, icon: Icon, label }) => {
              const active = appearancePreset === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => handleAppearance(value)}
                  className={segmentedOptionClass(active, "icon")}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label="Chat font">
          <SettingsOptionPicker
            value={chatFontValue}
            options={chatFontOptions}
            onValueChange={(value) =>
              setChatFont(value === "Clauxen Serif" ? "Default" : value)
            }
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
          <div className={cn(segmentedTrackClass, "shrink-0")}>
            {motionOptions.map((option) => {
              const active = motion === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMotion(option)}
                  className={segmentedOptionClass(active)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <SettingsToggleRow
          label="Follow-up suggestions"
          description="Show suggested follow-up questions after responses."
          checked={followUpSuggestions}
          onCheckedChange={setFollowUpSuggestions}
          borderless
        />
      </SettingsSection>
    </div>
  );
}
