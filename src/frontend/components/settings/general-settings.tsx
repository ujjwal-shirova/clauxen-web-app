"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { fontThemes, motionOptions } from "./constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "./settings-ui";

const WORK_OPTIONS = [
  "Select",
  "Engineering",
  "Design",
  "Product",
  "Research",
  "Founder",
  "Student",
  "Other",
] as const;

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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const inputClass =
  "h-9 w-full max-w-[20rem] rounded-lg border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400";

interface GeneralSettingsProps {
  appearancePreset: string;
  setAppearancePreset: (value: string) => void;
  setColorMode: (value: string) => void;
  chatFont: string;
  setChatFont: (value: string) => void;
  motion: string;
  setMotion: (value: string) => void;
  responseCompletions: boolean;
  setResponseCompletions: (value: boolean) => void;
  fullName?: string;
  nickname?: string;
  occupation?: string;
  customInstructions?: string;
  onProfileChange?: (patch: {
    fullName?: string;
    nickname?: string;
    occupation?: string;
    customInstructions?: string;
  }) => void;
}

export function GeneralSettings({
  appearancePreset,
  setAppearancePreset,
  setColorMode,
  chatFont,
  setChatFont,
  motion,
  setMotion,
  responseCompletions,
  setResponseCompletions,
  fullName = "",
  nickname = "",
  occupation = "",
  customInstructions = "",
  onProfileChange,
}: GeneralSettingsProps) {
  const [nameDraft, setNameDraft] = useState(fullName);
  const [callMeDraft, setCallMeDraft] = useState(nickname || fullName);
  const [workDraft, setWorkDraft] = useState(
    occupation && WORK_OPTIONS.includes(occupation as (typeof WORK_OPTIONS)[number])
      ? occupation
      : "Select",
  );
  const [instructionsDraft, setInstructionsDraft] = useState(customInstructions);

  useEffect(() => setNameDraft(fullName), [fullName]);
  useEffect(() => setCallMeDraft(nickname || fullName), [nickname, fullName]);
  useEffect(() => {
    setWorkDraft(
      occupation &&
        WORK_OPTIONS.includes(occupation as (typeof WORK_OPTIONS)[number])
        ? occupation
        : "Select",
    );
  }, [occupation]);
  useEffect(() => setInstructionsDraft(customInstructions), [customInstructions]);

  const avatarInitials = useMemo(
    () => initialsFromName(nameDraft || callMeDraft || "U"),
    [nameDraft, callMeDraft],
  );

  const handleAppearance = (preset: string) => {
    setAppearancePreset(preset);
    setColorMode(syncColorMode(preset));
  };

  const chatFontOptions = useMemo(
    () =>
      fontThemes.map((theme) =>
        theme.name === "Default" ? "Clauxen Serif" : theme.name,
      ),
    [],
  );

  const chatFontValue =
    chatFont === "Default" ? "Clauxen Serif" : chatFont;

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection title="Profile">
        <SettingsRow label="Avatar">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-[13px] font-semibold text-zinc-700"
            aria-hidden
          >
            {avatarInitials}
          </div>
        </SettingsRow>

        <SettingsRow label="Full name">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => onProfileChange?.({ fullName: nameDraft.trim() })}
            className={inputClass}
            autoComplete="name"
          />
        </SettingsRow>

        <SettingsRow label="What should Clauxen call you?">
          <input
            type="text"
            value={callMeDraft}
            onChange={(e) => setCallMeDraft(e.target.value)}
            onBlur={() => onProfileChange?.({ nickname: callMeDraft.trim() })}
            className={inputClass}
          />
        </SettingsRow>

        <SettingsRow label="What best describes your work?">
          <SettingsOptionPicker
            value={workDraft}
            options={WORK_OPTIONS}
            onValueChange={(value) => {
              setWorkDraft(value);
              onProfileChange?.({
                occupation: value === "Select" ? "" : value,
              });
            }}
          />
        </SettingsRow>

        <div className="border-b border-zinc-100 py-3">
          <p className="text-[14px] text-zinc-900">Instructions for Clauxen</p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            Clauxen will keep these in mind across chats within{" "}
            <a href="/legal/terms" className="text-[#1b67b2] hover:underline">
              Clauxen&apos;s guidelines
            </a>
            .{" "}
            <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
              Learn more
            </a>
          </p>
          <textarea
            value={instructionsDraft}
            onChange={(e) => setInstructionsDraft(e.target.value)}
            onBlur={() =>
              onProfileChange?.({
                customInstructions: instructionsDraft.trim(),
              })
            }
            rows={4}
            placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
            className="mt-3 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[14px] leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>
      </SettingsSection>

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
            value={chatFontValue}
            options={chatFontOptions}
            onValueChange={(value) =>
              setChatFont(value === "Clauxen Serif" ? "Default" : value)
            }
          />
        </SettingsRow>

        <div className="flex min-h-[72px] items-start justify-between gap-4 py-3">
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
