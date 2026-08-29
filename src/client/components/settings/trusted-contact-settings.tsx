"use client";

import {
  SettingsAddFamilyButton,
  SettingsPanelTitle,
  SettingsSection,
} from "@/components/settings/settings-ui";

export function TrustedContactSettings() {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Trusted contact</SettingsPanelTitle>
      <SettingsSection title="Safety contact">
        <div className="px-[var(--settings-row-pad-x)] py-5">
          <p className="max-w-[600px] text-[14px] leading-6 text-[var(--settings-fg)]">
            Having a trusted contact can make it easier to get support from
            someone who knows you well.
          </p>
          <p className="mt-3 max-w-[600px] text-[13px] leading-5 text-[var(--settings-fg-muted)]">
            In the future, if you discuss serious safety concerns with Clauxen
            in a way that indicates risk, we may automatically notify your
            trusted contact so they can check in with you. They must be 18+ to
            participate.{" "}
            <a
              href="https://help.openai.com/articles/20001105"
              className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </p>
          <SettingsAddFamilyButton onClick={() => {}} className="mt-5">
            Add contact
          </SettingsAddFamilyButton>
        </div>
      </SettingsSection>
    </div>
  );
}
