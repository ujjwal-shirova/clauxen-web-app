"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "@/components/ui/bootstrap-icon";
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
  SettingsConfirmDialog,
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
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
    setInstructionsOpen(false);
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
            aria-label="What should Clauxen call you?"
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
          description="Tell Clauxen what to keep in mind when responding."
        >
          <SettingsButton
            onClick={() => {
              setInstructionsDraft(p.customInstructions || "");
              setInstructionsOpen(true);
            }}
          >
            Edit
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Response style"
        description="Tone and formatting of replies."
      >
        <SettingsRow label="Response length">
          <SettingsOptionPicker
            value={p.responsePreference || "balanced"}
            options={[
              { value: "balanced", label: "Balanced" },
              { value: "concise", label: "Short and direct" },
              { value: "detailed", label: "Detailed" },
            ]}
            onValueChange={(value) => {
              if (
                value === "balanced" ||
                value === "concise" ||
                value === "detailed"
              )
                onChange({ responsePreference: value });
            }}
            aria-label="Response length"
          />
        </SettingsRow>
        <SettingsRow label="Base style and tone">
          <SettingsOptionPicker
            value={p.baseStyleTone || "Default"}
            options={baseStyleToneOptionItems}
            onValueChange={(baseStyleTone) => onChange({ baseStyleTone })}
            aria-label="Base style and tone"
          />
        </SettingsRow>
        <CharacteristicRow
          label="Warmth"
          value={p.characteristicWarm}
          options={characteristicWarmOptions}
          onChange={(characteristicWarm) => onChange({ characteristicWarm })}
        />
        <CharacteristicRow
          label="Enthusiasm"
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
        description="Choose how Clauxen reflects on your chats."
      >
        <SettingsRow label="Summary range">
          <SettingsOptionPicker
            value={reflectRange || "Past month"}
            options={REFLECT_RANGES}
            onValueChange={onReflectRangeChange}
            aria-label="Activity summary range"
          />
        </SettingsRow>
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
              label="Fast answers"
              description="Shorter answers from general knowledge when possible."
              checked={p.fastAnswers}
              onCheckedChange={(fastAnswers) => onChange({ fastAnswers })}
            />
            <SettingsToggleRow
              label="Extended thinking"
              description="Think longer before answering."
              checked={p.extendedThinking}
              onCheckedChange={(extendedThinking) =>
                onChange({ extendedThinking })
              }
              borderless
            />

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
      <SettingsConfirmDialog
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
        title="Custom instructions"
        description="These instructions apply across your conversations."
        confirmLabel="Save"
        onConfirm={commitInstructions}
      >
        <textarea
          aria-label="Custom instructions"
          value={instructionsDraft}
          onChange={(event) =>
            setInstructionsDraft(
              event.target.value.slice(0, MAX_CUSTOM_INSTRUCTIONS),
            )
          }
          rows={8}
          maxLength={MAX_CUSTOM_INSTRUCTIONS}
          placeholder="For example, use analogies when explaining new concepts."
          className="settings-field min-h-[180px] w-full resize-y py-3"
        />
        <p className="text-right text-xs text-[var(--settings-fg-muted)]">
          {instructionsDraft.length.toLocaleString()} /{" "}
          {MAX_CUSTOM_INSTRUCTIONS.toLocaleString()}
        </p>
      </SettingsConfirmDialog>
    </SettingsPage>
  );
}
