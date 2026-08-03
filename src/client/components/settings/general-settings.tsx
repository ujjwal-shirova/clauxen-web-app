"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonalizationSettings } from "@/lib/api/settings";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/lib/segmented-control";
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
import type { UserProfile } from "@/lib/api/profile";
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

const inputClass = "settings-field max-w-[20rem]";

interface GeneralSettingsProps {
  personalization: PersonalizationSettings;
  onPersonalizationChange: (patch: Partial<PersonalizationSettings>) => void;
  avatarUrl?: string | null;
  onAvatarUpdated?: (profile: UserProfile) => void;
  appearancePreset: string;
  /** Single optimistic update — UI theme applies before DB persist. */
  onAppearanceChange: (preset: string) => void;
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
  onAppearanceChange,
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
        <SettingsRow
          label="Custom instructions"
          description="Clauxen will keep these in mind across chats within Shirova guidelines."
          className="!flex-col !items-stretch sm:!flex-col"
        >
          <div className="w-full">
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
              className="settings-field mt-1 min-h-[96px] w-full resize-y py-2"
            />
            <p className="mt-1.5 text-right text-[11px] text-[var(--settings-fg-muted)]">
              {instructionsDraft.length}/{MAX_CUSTOM_INSTRUCTIONS}
            </p>
          </div>
        </SettingsRow>
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
                  onClick={() => onAppearanceChange(value)}
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

        <SettingsRow
          label="Motion"
          description="Reduce animation in streaming responses and other interface elements."
        >
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
        </SettingsRow>

        <SettingsToggleRow
          label="Follow-up suggestions"
          description="Let Clauxen end replies with clickable follow-up prompts."
          checked={followUpSuggestions}
          onCheckedChange={setFollowUpSuggestions}
          borderless
        />
      </SettingsSection>
    </div>
  );
}
