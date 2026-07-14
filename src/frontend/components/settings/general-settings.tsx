"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { PersonalizationSettings } from "@/frontend/lib/api/settings";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/frontend/lib/segmented-control";
import { motionOptions } from "./constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
  type SettingsOptionItem,
} from "./settings-ui";
import { ProfileAvatarUpload } from "./profile-avatar-upload";
import type { UserProfile } from "@/frontend/lib/api/profile";
import { WORK_ROLE_OPTIONS } from "@/lib/work-roles";
import {
  CHAT_FONT_OPTIONS,
  chatFontOption,
  normalizeChatFontId,
} from "@/lib/app-preferences";

const appearanceModes = [
  { value: "System", icon: Monitor, label: "System" },
  { value: "Light", icon: Sun, label: "Light" },
  { value: "Dark", icon: Moon, label: "Dark" },
] as const;

const MAX_CUSTOM_INSTRUCTIONS = 1500;

const inputClass =
  "h-9 w-full max-w-[20rem] rounded-lg border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

function syncColorMode(preset: string): string {
  if (preset === "Light") return "Light";
  if (preset === "Dark") return "Dark";
  return "Auto";
}

interface GeneralSettingsProps {
  personalization: PersonalizationSettings;
  onPersonalizationChange: (patch: Partial<PersonalizationSettings>) => void;
  avatarUrl?: string | null;
  onAvatarUpdated?: (profile: UserProfile) => void;
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
  personalization,
  onPersonalizationChange,
  avatarUrl,
  onAvatarUpdated,
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
  const p = personalization;
  const [nameDraft, setNameDraft] = useState(p.fullName);
  const [callMeDraft, setCallMeDraft] = useState(p.nickname || p.fullName);
  const [instructionsDraft, setInstructionsDraft] = useState(
    p.customInstructions,
  );

  useEffect(() => setNameDraft(p.fullName), [p.fullName]);
  useEffect(
    () => setCallMeDraft(p.nickname || p.fullName),
    [p.nickname, p.fullName],
  );
  useEffect(
    () => setInstructionsDraft(p.customInstructions),
    [p.customInstructions],
  );

  const avatarName = useMemo(
    () => nameDraft || callMeDraft || "U",
    [nameDraft, callMeDraft],
  );

  const workOptions = useMemo(() => {
    const base = ["Select", ...WORK_ROLE_OPTIONS] as string[];
    if (p.occupation && !base.includes(p.occupation)) {
      return ["Select", p.occupation, ...WORK_ROLE_OPTIONS];
    }
    return base;
  }, [p.occupation]);

  const workValue = p.occupation?.trim() ? p.occupation : "Select";

  const handleAppearance = (preset: string) => {
    setAppearancePreset(preset);
    setColorMode(syncColorMode(preset));
  };

  const chatFontOptions: SettingsOptionItem[] = useMemo(
    () =>
      CHAT_FONT_OPTIONS.map((option) => ({
        value: option.id,
        label: option.label,
        labelStyle: {
          fontFamily: option.cssVar
            ? `var(${option.cssVar}), ${option.stack}`
            : option.stack,
        },
      })),
    [],
  );
  const chatFontValue = normalizeChatFontId(chatFont);
  const selectedChatFont = chatFontOption(chatFontValue);

  const commitInstructions = () => {
    const next = instructionsDraft.trim().slice(0, MAX_CUSTOM_INSTRUCTIONS);
    setInstructionsDraft(next);
    onPersonalizationChange({ customInstructions: next });
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900 dark:text-zinc-100">
      <SettingsPanelTitle>General</SettingsPanelTitle>

      <SettingsSection title="Profile">
        <SettingsRow label="Avatar">
          <ProfileAvatarUpload
            name={avatarName}
            avatarUrl={avatarUrl}
            onUpdated={onAvatarUpdated}
          />
        </SettingsRow>
        <SettingsRow label="Full name">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() =>
              onPersonalizationChange({ fullName: nameDraft.trim() })
            }
            className={inputClass}
            autoComplete="name"
            maxLength={120}
          />
        </SettingsRow>
        <SettingsRow label="What should Clauxen call you?">
          <input
            type="text"
            value={callMeDraft}
            onChange={(e) => setCallMeDraft(e.target.value)}
            onBlur={() =>
              onPersonalizationChange({ nickname: callMeDraft.trim() })
            }
            className={inputClass}
            maxLength={120}
          />
        </SettingsRow>
        <SettingsRow label="What best describes your work?">
          <SettingsOptionPicker
            value={workValue}
            options={workOptions}
            onValueChange={(value) =>
              onPersonalizationChange({
                occupation: value === "Select" ? "" : value,
              })
            }
          />
        </SettingsRow>
        <div className="border-b border-zinc-100 py-3 last:border-b-0">
          <p className="text-[14px] text-zinc-900">Custom instructions</p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            Clauxen will keep these in mind across chats within Shirova
            guidelines.
          </p>
          <textarea
            value={instructionsDraft}
            onChange={(e) =>
              setInstructionsDraft(
                e.target.value.slice(0, MAX_CUSTOM_INSTRUCTIONS),
              )
            }
            onBlur={commitInstructions}
            rows={4}
            maxLength={MAX_CUSTOM_INSTRUCTIONS}
            placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
            className="mt-3 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[14px] leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
          <p className="mt-1.5 text-right text-[11px] text-zinc-400">
            {instructionsDraft.length}/{MAX_CUSTOM_INSTRUCTIONS}
          </p>
        </div>
      </SettingsSection>

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
            onValueChange={(value) => setChatFont(normalizeChatFontId(value))}
            aria-label={`Chat font: ${selectedChatFont.label}`}
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
