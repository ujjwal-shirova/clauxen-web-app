"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSection,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";

export type PrivacySettingsState = {
  locationMetadata: boolean;
  helpImproveModels: boolean;
};

interface PrivacySettingsProps {
  privacy: PrivacySettingsState;
  onChange: (patch: Partial<PrivacySettingsState>) => void;
  onExportData?: () => void;
}

export function PrivacySettings({
  privacy,
  onChange,
  onExportData,
}: PrivacySettingsProps) {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Privacy</SettingsPanelTitle>

      <section className="mb-8">
        <h2 className="text-[20px] font-semibold tracking-tight text-zinc-900">
          Privacy
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-zinc-600">
          Learn how your information is protected when using Clauxen products,
          and visit our{" "}
          <a
            href="/legal/privacy"
            className="text-[#1b67b2] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Center
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            className="text-[#1b67b2] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>{" "}
          for more details.
        </p>

        <div className="mt-4 flex flex-col">
          {[
            "How we protect your data",
            "How we use your data",
          ].map((label) => (
            <button
              key={label}
              type="button"
              className="flex h-11 items-center justify-between border-b border-zinc-100 text-left text-[14px] text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              <span>{label}</span>
              <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <SettingsSection title="Preferences">
        <SettingsToggleRow
          label="Location metadata"
          description={
            <>
              Allow Clauxen to use coarse location metadata (city/region) to
              improve product experiences.{" "}
              <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
                Learn more
              </a>
              .
            </>
          }
          checked={privacy.locationMetadata}
          onCheckedChange={(locationMetadata) => onChange({ locationMetadata })}
        />
        <SettingsToggleRow
          label="Help improve our AI models"
          description={
            <>
              Allow the use of your chats and coding sessions to train and
              improve Clauxen.{" "}
              <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
                Learn more
              </a>
              .
            </>
          }
          checked={privacy.helpImproveModels}
          onCheckedChange={(helpImproveModels) =>
            onChange({ helpImproveModels })
          }
        />
      </SettingsSection>

      <SettingsSection title="Your data">
        <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
          <span className="text-[14px] font-medium">Export data</span>
          <SettingsPillButton onClick={onExportData}>
            Export data
          </SettingsPillButton>
        </div>
        <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
          <span className="text-[14px] font-medium">Shared chats</span>
          <SettingsPillButton>Manage</SettingsPillButton>
        </div>
        <div className="flex min-h-[56px] items-center justify-between gap-4 py-3">
          <span className="text-[14px] font-medium">Shared artifacts</span>
          <SettingsPillButton>Manage</SettingsPillButton>
        </div>
      </SettingsSection>
    </div>
  );
}
