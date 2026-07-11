"use client";

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

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>
      <h2 className="mb-6 text-[20px] font-semibold tracking-tight">
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
