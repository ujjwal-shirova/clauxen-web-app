"use client";

import { useEffect, useMemo, useState } from "react";
import type { PersonalizationSettings } from "@/frontend/lib/api/settings";
import {
  baseStyleToneOptions,
  personalityOptions,
} from "@/frontend/components/settings/constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";

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

const inputClass =
  "h-9 w-full max-w-[20rem] rounded-lg border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

interface PersonalizationSettingsProps {
  personalization: PersonalizationSettings;
  onChange: (patch: Partial<PersonalizationSettings>) => void;
  onManageMemory?: () => void;
}

export function PersonalizationSettingsPanel({
  personalization,
  onChange,
  onManageMemory,
}: PersonalizationSettingsProps) {
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

  const avatarInitials = useMemo(
    () => initialsFromName(nameDraft || callMeDraft || "U"),
    [nameDraft, callMeDraft],
  );

  const workValue =
    p.occupation &&
    WORK_OPTIONS.includes(p.occupation as (typeof WORK_OPTIONS)[number])
      ? p.occupation
      : "Select";

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>
      <h2 className="mb-6 text-[20px] font-semibold tracking-tight">
        Personalization
      </h2>

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
            onBlur={() => onChange({ fullName: nameDraft.trim() })}
            className={inputClass}
            autoComplete="name"
          />
        </SettingsRow>
        <SettingsRow label="What should Clauxen call you?">
          <input
            type="text"
            value={callMeDraft}
            onChange={(e) => setCallMeDraft(e.target.value)}
            onBlur={() => onChange({ nickname: callMeDraft.trim() })}
            className={inputClass}
          />
        </SettingsRow>
        <SettingsRow label="What best describes your work?">
          <SettingsOptionPicker
            value={workValue}
            options={WORK_OPTIONS}
            onValueChange={(value) =>
              onChange({ occupation: value === "Select" ? "" : value })
            }
          />
        </SettingsRow>
        <div className="border-b border-zinc-100 py-3">
          <p className="text-[14px] text-zinc-900">Custom instructions</p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            Clauxen will keep these in mind across chats within product
            guidelines.
          </p>
          <textarea
            value={instructionsDraft}
            onChange={(e) => setInstructionsDraft(e.target.value)}
            onBlur={() =>
              onChange({ customInstructions: instructionsDraft.trim() })
            }
            rows={4}
            placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
            className="mt-3 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[14px] leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Style">
        <SettingsRow
          label="Personality"
          description="How Clauxen communicates. This doesn’t change what it can do."
        >
          <SettingsOptionPicker
            value={p.personality || "Default"}
            options={personalityOptions}
            onValueChange={(personality) => onChange({ personality })}
          />
        </SettingsRow>
        <SettingsRow
          label="Base style and tone"
          description="Additional tone on top of personality."
          borderless
        >
          <SettingsOptionPicker
            value={p.baseStyleTone}
            options={baseStyleToneOptions}
            onValueChange={(baseStyleTone) => onChange({ baseStyleTone })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Memory">
        <SettingsToggleRow
          label="Reference saved memories"
          description="Let Clauxen use memories it has saved about you. Generating new memories is controlled in Capabilities."
          checked={p.referenceSavedMemories}
          onCheckedChange={(referenceSavedMemories) =>
            onChange({ referenceSavedMemories })
          }
        />
        <SettingsToggleRow
          label="Reference chat history"
          description="Let Clauxen use recent chat history for better context."
          checked={p.referenceChatHistory}
          onCheckedChange={(referenceChatHistory) =>
            onChange({ referenceChatHistory })
          }
        />
        <div className="flex min-h-[56px] items-center justify-between gap-4 py-3">
          <div>
            <p className="text-[14px] font-medium">Manage memories</p>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Review or delete saved memories.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageMemory}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-4 text-[14px] font-medium hover:bg-zinc-50"
          >
            Manage
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
