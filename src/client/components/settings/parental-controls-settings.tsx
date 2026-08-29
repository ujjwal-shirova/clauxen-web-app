"use client";

import {
  SettingsAddFamilyButton,
  SettingsPanelTitle,
  SettingsSection,
} from "@/components/settings/settings-ui";

export function ParentalControlsSettings() {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Parental controls</SettingsPanelTitle>
      <SettingsSection title="Family accounts">
        <div className="px-[var(--settings-row-pad-x)] py-5">
          <p className="max-w-[600px] text-[14px] leading-6 text-[var(--settings-fg-muted)]">
            Parents and teens can link accounts, giving parents tools to adjust
            certain features, set limits, and add safeguards that work for their
            family.{" "}
            <a
              href="https://help.openai.com/articles/12315553-parental-controls-on-chatgpt-faq"
              className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </p>
          <SettingsAddFamilyButton onClick={() => {}} className="mt-5">
            Add family member
          </SettingsAddFamilyButton>
        </div>
      </SettingsSection>
    </div>
  );
}
