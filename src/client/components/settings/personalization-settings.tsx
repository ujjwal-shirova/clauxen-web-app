"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PersonalizationSettings } from "@/lib/api/settings";
import {
  baseStyleToneOptionItems,
  characteristicEmojiOptions,
  characteristicEnthusiasticOptions,
  characteristicHeadersListsOptions,
  characteristicWarmOptions,
} from "@/components/settings/constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";

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
  onManageMemory,
}: PersonalizationSettingsProps) {
  const p = personalization;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>

      <SettingsSection title="Style">
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

      <SettingsSection
        title="Characteristics"
        description="Choose additional customizations on top of your base style and tone."
      >
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
        <SettingsRow
          label="Manage memories"
          description="Review or delete saved memories."
        >
          <button
            type="button"
            onClick={onManageMemory}
            className="settings-btn"
          >
            Manage
          </button>
        </SettingsRow>
        <p className="px-[var(--settings-row-pad-x)] py-3 text-[12px] leading-[18px] text-[var(--settings-fg-muted)]">
          Clauxen may use Memory to personalize queries to search providers.{" "}
          <a
            href="/legal/privacy"
            className="underline underline-offset-2 hover:text-[var(--settings-fg)]"
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
          className="no-hover-overlay flex w-full items-center justify-between gap-3 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] text-left"
        >
          <h3 className="text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
            Advanced
          </h3>
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
