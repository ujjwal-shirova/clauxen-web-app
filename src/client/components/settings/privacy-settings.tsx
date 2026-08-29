"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import * as settingsApi from "@/lib/api/settings-extended";
import { openCookieSettings } from "@/lib/cookie-consent";

export type PrivacySettingsState = {
  locationMetadata: boolean;
  helpImproveModels: boolean;
};

interface PrivacySettingsProps {
  privacy: PrivacySettingsState;
  onChange: (patch: Partial<PrivacySettingsState>) => void;
  onGoToPersonalization?: () => void;
}

export function PrivacySettings({
  privacy,
  onChange,
  onGoToPersonalization,
}: PrivacySettingsProps) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { job } = await settingsApi.requestDataExport();
      setMessage(`Export requested (${job.id.slice(0, 8)}…).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Privacy</SettingsPanelTitle>

      <section className="settings-card mb-7 p-5">
        <p className="max-w-xl text-[14px] leading-relaxed text-[var(--settings-fg-muted)]">
          Learn how your information is protected when using Clauxen products,
          and visit our{" "}
          <a
            href="/legal/privacy"
            className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
          >
            Privacy Center
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>
        <div className="mt-4 flex flex-col border-t border-[var(--settings-hairline)]">
          {["How we protect your data", "How we use your data"].map((label) => (
            <button
              key={label}
              type="button"
              className="flex h-11 items-center justify-between border-b border-[var(--settings-hairline)] text-left text-[14px] text-[var(--settings-fg)] transition-colors last:border-b-0 hover:bg-[var(--settings-nav-hover-bg)]"
            >
              <span>{label}</span>
              <ChevronRight
                className="h-4 w-4 text-[var(--settings-fg-subtle)]"
                aria-hidden
              />
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
              <a
                href="/legal/privacy"
                className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
              >
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
              <a
                href="/legal/privacy"
                className="font-medium text-[var(--settings-fg)] underline underline-offset-2"
              >
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
        <SettingsRow
          label="Cookie settings"
          description="Choose optional performance and advertising cookies. Essential cookies stay on."
          borderless
        >
          <SettingsPillButton onClick={() => openCookieSettings()}>
            Manage
          </SettingsPillButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Your data">
        <SettingsRow label="Export data">
          <SettingsPillButton onClick={() => void handleExport()}>
            {exporting ? "Requesting…" : "Export data"}
          </SettingsPillButton>
        </SettingsRow>
        <SettingsRow label="Archive all chats">
          <SettingsPillButton
            onClick={() =>
              window.confirm("Archive all chats? You can still export later.")
            }
          >
            Archive all
          </SettingsPillButton>
        </SettingsRow>
        <SettingsRow label="Shared chats">
          <SettingsPillButton>Manage</SettingsPillButton>
        </SettingsRow>
        <SettingsRow label="Shared artifacts">
          <SettingsPillButton>Manage</SettingsPillButton>
        </SettingsRow>
        <SettingsRow label="Memory preferences" borderless>
          <SettingsPillButton onClick={onGoToPersonalization}>
            Manage
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </SettingsPillButton>
        </SettingsRow>
        {(message || error) && (
          <p
            className={`border-t border-[var(--settings-hairline)] px-[var(--settings-row-pad-x)] py-3 text-[13px] ${error ? "text-rose-600" : "text-[var(--settings-fg-muted)]"}`}
          >
            {error ?? message}
          </p>
        )}
      </SettingsSection>
    </div>
  );
}
