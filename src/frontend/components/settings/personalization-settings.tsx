"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PersonalizationSettings } from "@/frontend/lib/api/settings";
import {
  baseStyleToneOptionItems,
  characteristicEmojiOptions,
  characteristicEnthusiasticOptions,
  characteristicHeadersListsOptions,
  characteristicWarmOptions,
  personalityOptions,
} from "@/frontend/components/settings/constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";
import { cn } from "@/frontend/lib/utils";

export type PersonalizationAdvancedState = {
  webSearch: boolean;
  canvas: boolean;
  connectorSearch: boolean;
};

interface PersonalizationSettingsProps {
  personalization: PersonalizationSettings;
  onChange: (patch: Partial<PersonalizationSettings>) => void;
  advanced: PersonalizationAdvancedState;
  onAdvancedChange: (patch: Partial<PersonalizationAdvancedState>) => void;
  onManageMemory?: () => void;
}

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
    <div
      className={cn(
        "flex min-h-[44px] items-center justify-between gap-4 py-2.5",
        !borderless && "border-b border-[rgba(11,11,11,0.05)]",
      )}
    >
      <p className="text-[14px] leading-5 text-zinc-900">{label}</p>
      <SettingsOptionPicker
        value={value || "Default"}
        options={options}
        onValueChange={onChange}
        aria-label={`${label}: ${value || "Default"}`}
      />
    </div>
  );
}

export function PersonalizationSettingsPanel({
  personalization,
  onChange,
  advanced,
  onAdvancedChange,
  onManageMemory,
}: PersonalizationSettingsProps) {
  const p = personalization;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>
      <h2 className="mb-5 text-[20px] font-semibold tracking-tight text-zinc-900">
        Personalization
      </h2>

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
          description="Set the style and tone of how Clauxen responds to you. This doesn’t impact Clauxen’s capabilities."
          borderless
        >
          <SettingsOptionPicker
            value={p.baseStyleTone || "Default"}
            options={baseStyleToneOptionItems}
            onValueChange={(baseStyleTone) => onChange({ baseStyleTone })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Characteristics">
        <p className="mb-1 text-[13px] leading-snug text-zinc-500">
          Choose additional customizations on top of your base style and tone.
        </p>
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
          label="Headers & Lists"
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

      <SettingsSection>
        <SettingsToggleRow
          label="Fast answers"
          description="Clauxen can sometimes use its general knowledge to give faster, less in-depth answers. These aren’t personalized and don’t use your memory."
          checked={p.fastAnswers}
          onCheckedChange={(fastAnswers) => onChange({ fastAnswers })}
          borderless
        />
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
        <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-[rgba(11,11,11,0.05)] py-3">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-[14px] font-medium text-zinc-900">
              Manage memories
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
              Review or delete saved memories.
            </p>
          </div>
          <button
            type="button"
            onClick={onManageMemory}
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            Manage
          </button>
        </div>
        <p className="pt-3 text-[12px] leading-relaxed text-zinc-500">
          Clauxen may use Memory to personalize queries to search providers.{" "}
          <a
            href="/legal/privacy"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
          >
            Learn more
          </a>
        </p>
      </SettingsSection>

      <SettingsSection>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="no-hover-overlay flex w-full items-center justify-between gap-3 py-1 text-left"
        >
          <h3 className="text-[15px] font-semibold leading-5 text-zinc-900">
            Advanced
          </h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200",
              advancedOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {advancedOpen ? (
          <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <SettingsToggleRow
              label="Web search"
              description="Let Clauxen automatically search the web for answers."
              checked={advanced.webSearch}
              onCheckedChange={(webSearch) => onAdvancedChange({ webSearch })}
            />
            <SettingsToggleRow
              label="Canvas"
              description="Collaborate with Clauxen on text and code."
              checked={advanced.canvas}
              onCheckedChange={(canvas) => onAdvancedChange({ canvas })}
            />
            <SettingsToggleRow
              label="Connector search"
              description="Let Clauxen automatically search connected sources for answers."
              checked={advanced.connectorSearch}
              onCheckedChange={(connectorSearch) =>
                onAdvancedChange({ connectorSearch })
              }
              borderless
            />
          </div>
        ) : null}
      </SettingsSection>
    </div>
  );
}
