"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { PersonalizationSettings } from "@/lib/api/settings";
import {
  baseStyleToneOptionItems,
  characteristicEmojiOptions,
  characteristicEnthusiasticOptions,
  characteristicHeadersListsOptions,
  characteristicWarmOptions,
} from "@/components/settings/constants";
import {
  SettingsButton,
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import { WORK_ROLE_OPTIONS } from "@/lib/work-roles";
import { cn } from "@/lib/utils";

export type PersonalizationAdvancedState = {
  webSearch: boolean;
  canvas: boolean;
};

interface PersonalizationSettingsProps {
  personalization: PersonalizationSettings;
  onChange: (patch: Partial<PersonalizationSettings>) => void;
  advanced: PersonalizationAdvancedState;
  onAdvancedChange: (patch: Partial<PersonalizationAdvancedState>) => void;
  reflectRange: string;
  onReflectRangeChange: (value: string) => void;
  generateMemory: boolean;
  onGenerateMemoryChange: (value: boolean) => void;
  onManageMemory?: () => void;
}

const REFLECT_RANGES = [
  "Past week",
  "Past month",
  "Past 3 months",
  "Past year",
] as const;

const MAX_CUSTOM_INSTRUCTIONS = 1500;

function CharacteristicRow({
  label,
  value,
  options,
  onChange,
  borderless,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; description?: string }[];
  onChange: (value: string) => void;
  borderless?: boolean;
}) {
  return (
    <SettingsRow label={label} borderless={borderless}>
      <SettingsOptionPicker
        value={value || "Default"}
        options={options}
        onValueChange={onChange}
        aria-label={`${label}: ${value || "Default"}`}
      />
    </SettingsRow>
  );
}

export function PersonalizationSettingsPanel({
  personalization,
  onChange,
  advanced,
  onAdvancedChange,
  reflectRange,
  onReflectRangeChange,
  generateMemory,
  onGenerateMemoryChange,
  onManageMemory,
}: PersonalizationSettingsProps) {
  const p = personalization;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [callMeDraft, setCallMeDraft] = useState(p.nickname || "");
  const [instructionsDraft, setInstructionsDraft] = useState(
    p.customInstructions || "",
  );

  useEffect(() => setCallMeDraft(p.nickname || ""), [p.nickname]);
  useEffect(
    () => setInstructionsDraft(p.customInstructions || ""),
    [p.customInstructions],
  );

  const workOptions = useMemo(() => {
    const base = ["Select", ...WORK_ROLE_OPTIONS] as string[];
    if (p.occupation && !base.includes(p.occupation)) {
      return ["Select", p.occupation, ...WORK_ROLE_OPTIONS];
    }
    return base;
  }, [p.occupation]);
  const workValue = p.occupation?.trim() ? p.occupation : "Select";

  const commitInstructions = () => {
    const next = instructionsDraft.trim().slice(0, MAX_CUSTOM_INSTRUCTIONS);
    setInstructionsDraft(next);
    onChange({ customInstructions: next });
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>

      <SettingsSection
        title="About you"
        description="What Clauxen calls you and keeps in mind."
      >
        <SettingsRow label="What should Clauxen call you?">
          <input
            type="text"
            value={callMeDraft}
            onChange={(e) => setCallMeDraft(e.target.value)}
            onBlur={() => onChange({ nickname: callMeDraft.trim() })}
            placeholder="Nickname"
            className="settings-field max-w-[20rem]"
            maxLength={120}
          />
        </SettingsRow>
        <SettingsRow label="Work">
          <SettingsOptionPicker
            value={workValue}
            options={workOptions}
            onValueChange={(value) =>
              onChange({ occupation: value === "Select" ? "" : value })
            }
            aria-label="Work"
          />
        </SettingsRow>
        <SettingsRow
          label="Custom instructions"
          description="Kept in mind across chats."
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

      <SettingsSection
        title="Style"
        description="Tone and formatting of replies."
      >
        <SettingsRow label="Base style and tone">
          <SettingsOptionPicker
            value={p.baseStyleTone || "Default"}
            options={baseStyleToneOptionItems}
            onValueChange={(baseStyleTone) => onChange({ baseStyleTone })}
            aria-label="Base style and tone"
          />
        </SettingsRow>
        <CharacteristicRow
          label="Warm"
          value={p.characteristicWarm}
          options={characteristicWarmOptions}
          onChange={(characteristicWarm) => onChange({ characteristicWarm })}
        />
        <CharacteristicRow
          label="Enthusiastic"
          value={p.characteristicEnthusiastic}
          options={characteristicEnthusiasticOptions}
          onChange={(characteristicEnthusiastic) =>
            onChange({ characteristicEnthusiastic })
          }
        />
        <CharacteristicRow
          label="Headers & lists"
          value={p.characteristicHeadersLists}
          options={characteristicHeadersListsOptions}
          onChange={(characteristicHeadersLists) =>
            onChange({ characteristicHeadersLists })
          }
        />
        <CharacteristicRow
          label="Emoji"
          value={p.characteristicEmoji}
          options={characteristicEmojiOptions}
          onChange={(characteristicEmoji) => onChange({ characteristicEmoji })}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Memory"
        description="What Clauxen remembers and reuses."
      >
        <SettingsToggleRow
          label="Save memories"
          description="Remember relevant context from chats and projects."
          checked={generateMemory}
          onCheckedChange={onGenerateMemoryChange}
        />
        <SettingsToggleRow
          label="Use saved memories"
          description="Apply memories when answering."
          checked={p.referenceSavedMemories}
          onCheckedChange={(referenceSavedMemories) =>
            onChange({ referenceSavedMemories })
          }
        />
        <SettingsToggleRow
          label="Use chat history"
          description="Use recent chats for better context."
          checked={p.referenceChatHistory}
          onCheckedChange={(referenceChatHistory) =>
            onChange({ referenceChatHistory })
          }
        />
        <SettingsRow label="Saved memories" description="Review or delete.">
          <SettingsButton onClick={onManageMemory}>Manage</SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Activity"
        description="Summaries and answer depth."
        action={
          <button
            type="button"
            aria-label="Refresh activity"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
          >
            <RefreshCw className="size-4" />
          </button>
        }
      >
        <SettingsRow label="Summary range">
          <SettingsOptionPicker
            value={reflectRange || "Past month"}
            options={REFLECT_RANGES}
            onValueChange={onReflectRangeChange}
            aria-label="Activity summary range"
          />
        </SettingsRow>
        <SettingsToggleRow
          label="Fast answers"
          description="Shorter answers from general knowledge when possible."
          checked={p.fastAnswers}
          onCheckedChange={(fastAnswers) => onChange({ fastAnswers })}
        />
        <SettingsToggleRow
          label="Extended thinking"
          description="Think longer before answering."
          checked={p.extendedThinking}
          onCheckedChange={(extendedThinking) => onChange({ extendedThinking })}
          borderless
        />
      </SettingsSection>

      <SettingsSection card>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="no-hover-overlay flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
        >
          <span className="text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
            Advanced
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--settings-fg-muted)] transition-transform duration-200",
              advancedOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {advancedOpen ? (
          <div className="border-t border-[var(--settings-hairline)]">
            <SettingsToggleRow
              label="Web search"
              description="Search the web automatically when needed."
              checked={advanced.webSearch}
              onCheckedChange={(webSearch) => onAdvancedChange({ webSearch })}
            />
            <SettingsToggleRow
              label="Canvas"
              description="Draft text and code side by side."
              checked={advanced.canvas}
              onCheckedChange={(canvas) => onAdvancedChange({ canvas })}
              borderless
            />
          </div>
        ) : null}
      </SettingsSection>
    </SettingsPage>
  );
}
