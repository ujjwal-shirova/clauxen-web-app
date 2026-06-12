"use client";

import { Button } from "@/frontend/components/ui/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/frontend/components/ui/radio-group";
import type { PersonalizationSettings } from "@/frontend/lib/api/settings";
import { baseStyleToneOptions, characteristicLevelOptions } from "./constants";
import {
  SettingsCharacteristicSelect,
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSectionHeading,
  SettingsTextarea,
  SettingsToggleRow,
  settingsRadioItemClass,
} from "./settings-ui";

interface PersonalizationSettingsProps {
  personalization: PersonalizationSettings;
  toolMode: string;
  onChange: (patch: Partial<PersonalizationSettings>) => void;
  onToolModeChange: (value: string) => void;
  onGoToCustomize: (tab: "skills" | "connectors") => void;
}

export function PersonalizationSettingsPanel({
  personalization,
  toolMode,
  onChange,
  onToolModeChange,
  onGoToCustomize,
}: PersonalizationSettingsProps) {
  const p = personalization;

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Personalization</SettingsPanelTitle>

      <section className="flex flex-col gap-2">
        <SettingsRow
          label="Base style and tone"
          description="Set the style and tone of how Clauxen responds to you. This doesn't impact Clauxen's capabilities."
        >
          <SettingsOptionPicker
            value={p.baseStyleTone}
            options={baseStyleToneOptions}
            onValueChange={(baseStyleTone) => onChange({ baseStyleTone })}
            aria-label="Base style and tone"
          />
        </SettingsRow>

        <div className="pb-2 pt-1">
          <p className="text-[14px] font-[430] text-zinc-900">
            Characteristics
          </p>
          <p className="mt-1 text-[12px] leading-4 text-zinc-400">
            Choose additional customizations on top of your base style and tone.
          </p>
        </div>

        <SettingsCharacteristicSelect
          label="Warm"
          value={p.characteristicWarm}
          options={characteristicLevelOptions}
          onChange={(value) => onChange({ characteristicWarm: value })}
        />
        <SettingsCharacteristicSelect
          label="Enthusiastic"
          value={p.characteristicEnthusiastic}
          options={characteristicLevelOptions}
          onChange={(value) => onChange({ characteristicEnthusiastic: value })}
        />
        <SettingsCharacteristicSelect
          label="Headers & Lists"
          value={p.characteristicHeadersLists}
          options={characteristicLevelOptions}
          onChange={(value) => onChange({ characteristicHeadersLists: value })}
        />
        <SettingsCharacteristicSelect
          label="Emoji"
          value={p.characteristicEmoji}
          options={characteristicLevelOptions}
          onChange={(value) => onChange({ characteristicEmoji: value })}
        />
      </section>

      <SettingsToggleRow
        label="Fast answers"
        description="Clauxen can sometimes use its general knowledge to give fast, in-depth answers. These aren't personalized and don't use your memory."
        checked={p.fastAnswers}
        onCheckedChange={(checked) => onChange({ fastAnswers: checked })}
        borderless
      />

      <section className="flex flex-col gap-2 border-t border-[#0d0d0d]/5 pt-4">
        <p className="text-[14px] font-[430]">Custom instructions</p>
        <SettingsTextarea
          value={p.customInstructions}
          onChange={(value) => onChange({ customInstructions: value })}
          placeholder="Additional behavior, style, and tone preferences"
          rows={3}
        />
      </section>

      <section className="flex flex-col gap-5 border-t border-[#0d0d0d]/10 pt-6">
        <SettingsSectionHeading>About you</SettingsSectionHeading>

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-[430]">Nickname</label>
          <SettingsTextarea
            value={p.nickname}
            onChange={(value) => onChange({ nickname: value })}
            placeholder="What should Clauxen call you?"
            rows={1}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-[430]">Occupation</label>
          <SettingsTextarea
            value={p.occupation}
            onChange={(value) => onChange({ occupation: value })}
            placeholder="What do you do?"
            rows={2}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-[430]">More about you</label>
          <SettingsTextarea
            value={p.moreAboutYou}
            onChange={(value) => onChange({ moreAboutYou: value })}
            placeholder="Interests, values, or preferences to keep in mind"
            rows={3}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-[#0d0d0d]/10 pt-6">
        <SettingsSectionHeading
          action={
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-full border-[#0d0d0d]/15 px-3 text-[12px] font-medium"
            >
              Manage
            </Button>
          }
        >
          Memory
        </SettingsSectionHeading>

        <SettingsToggleRow
          label="Reference saved memories"
          description="Let Clauxen save and use memories when responding."
          checked={p.referenceSavedMemories}
          onCheckedChange={(checked) =>
            onChange({ referenceSavedMemories: checked })
          }
        />

        <SettingsToggleRow
          label="Reference chat history"
          description="Let Clauxen reference all previous conversations when responding."
          checked={p.referenceChatHistory}
          onCheckedChange={(checked) =>
            onChange({ referenceChatHistory: checked })
          }
          borderless
        />

        <p className="pb-2 text-[12px] leading-4 text-zinc-400">
          Clauxen may use memory to personalize queries to search providers.{" "}
          <a href="#" className="underline decoration-[#8f8f8f]/60">
            Learn more
          </a>
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-[#0d0d0d]/10 pt-6">
        <SettingsSectionHeading>Record mode</SettingsSectionHeading>

        <SettingsToggleRow
          label="Reference record history"
          description="Let Clauxen reference all previous recording transcripts and notes when responding."
          checked={p.referenceRecordHistory}
          onCheckedChange={(checked) =>
            onChange({ referenceRecordHistory: checked })
          }
          borderless
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-[#0d0d0d]/10 pt-6">
        <SettingsSectionHeading>Advanced</SettingsSectionHeading>

        <div className="flex flex-col gap-3 pb-4">
          <p className="text-[14px] font-semibold text-zinc-800">Tool access</p>
          <RadioGroup
            value={toolMode}
            onValueChange={onToolModeChange}
            className="gap-3"
          >
            {[
              {
                value: "auto",
                label: "Auto",
                hint: "Let Clauxen decide when to use tools.",
              },
              {
                value: "always",
                label: "Always",
                hint: "Prefer tools when available.",
              },
              {
                value: "never",
                label: "Never",
                hint: "Disable tool use in chat.",
              },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-100"
              >
                <RadioGroupItem
                  value={option.value}
                  className={settingsRadioItemClass}
                />
                <span>
                  <span className="block text-[14px] font-[430]">
                    {option.label}
                  </span>
                  <span className="block text-[12px] text-zinc-400">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <div>
            <p className="text-[14px] font-[430]">Skills & connectors</p>
            <p className="mt-1 text-[12px] text-zinc-400">
              Configure apps and skills from Customize.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-lg"
            onClick={() => onGoToCustomize("connectors")}
          >
            Open Customize
          </Button>
        </div>
      </section>
    </div>
  );
}
