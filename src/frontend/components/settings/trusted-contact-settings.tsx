"use client";

import {
  SettingsAddFamilyButton,
  SettingsPanelTitle,
} from "@/frontend/components/settings/settings-ui";

export function TrustedContactSettings() {
  return (
    <div className="flex max-w-[488px] animate-in fade-in flex-col gap-6 duration-300 text-zinc-900">
      <SettingsPanelTitle>Trusted contact</SettingsPanelTitle>

      <p className="text-[14px] leading-relaxed text-zinc-900">
        Having a trusted contact can make it easier to get support from someone
        who knows you well.
      </p>

      <p className="text-[14px] leading-relaxed text-zinc-900">
        In the future, if you discuss serious safety concerns with Clauxen in a
        way that indicates risk, we may automatically notify your trusted
        contact so they can check in with you. They must be 18+ to participate.{" "}
        <a
          href="https://help.openai.com/articles/20001105"
          className="underline decoration-zinc-400/60 underline-offset-2 hover:text-zinc-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </p>

      <div className="pt-2">
        <SettingsAddFamilyButton onClick={() => {}} className="min-h-11 px-5">
          Add contact
        </SettingsAddFamilyButton>
      </div>
    </div>
  );
}
