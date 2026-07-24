"use client";

import {
  SettingsAddFamilyButton,
  SettingsPanelHeaderWithHelp,
} from "@/components/settings/settings-ui";

export function ParentalControlsSettings() {
  return (
    <div className="flex animate-in fade-in flex-col gap-6 duration-300 text-zinc-900">
      <SettingsPanelHeaderWithHelp
        title="Parental controls"
        helpHref="https://help.openai.com/articles/12315553-parental-controls-on-chatgpt-faq"
        helpLabel="Learn more about parental controls"
      />

      <p className="text-[14px] leading-relaxed text-zinc-900">
        Parents and teens can link accounts, giving parents tools to adjust
        certain features, set limits, and add safeguards that work for their
        family.{" "}
        <a
          href="https://help.openai.com/articles/12315553-parental-controls-on-chatgpt-faq"
          className="underline decoration-zinc-400/60 underline-offset-2 hover:text-zinc-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </p>

      <SettingsAddFamilyButton onClick={() => {}}>
        Add family member
      </SettingsAddFamilyButton>
    </div>
  );
}
