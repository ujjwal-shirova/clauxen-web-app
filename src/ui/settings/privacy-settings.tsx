"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  SettingsButton,
  SettingsPage,
  SettingsPanelTitle,
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

interface PrivacySafetySettingsProps {
  privacy: PrivacySettingsState;
  onPrivacyChange: (patch: Partial<PrivacySettingsState>) => void;
  reduceSensitiveContent: boolean;
  onSafetyChange: (reduceSensitiveContent: boolean) => void;
  onGoToPersonalization?: () => void;
}

export function PrivacySafetySettings({
  privacy,
  onPrivacyChange,
  reduceSensitiveContent,
  onSafetyChange,
  onGoToPersonalization,
}: PrivacySafetySettingsProps) {
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
    <SettingsPage>
      <SettingsPanelTitle>Privacy and safety</SettingsPanelTitle>

      <SettingsSection
        title="How your data is used"
        description="Learn how information is protected, and what helps improve Clauxen."
      >
        <div className="flex flex-col border-b border-[var(--settings-hairline)] px-4 py-2 sm:px-5">
          {["How we protect your data", "How we use your data"].map((label) => (
            <a
              key={label}
              href="/legal/privacy"
              className="flex h-11 items-center justify-between text-left text-[14px] text-[var(--settings-fg)]"
            >
              <span>{label}</span>
              <ChevronRight
                className="h-4 w-4 text-[var(--settings-fg-subtle)]"
                aria-hidden
              />
            </a>
          ))}
        </div>
        <SettingsToggleRow
          label="Location metadata"
          description="Use coarse location (city or region) to improve answers."
          checked={privacy.locationMetadata}
          onCheckedChange={(locationMetadata) =>
            onPrivacyChange({ locationMetadata })
          }
        />
        <SettingsToggleRow
          label="Help improve models"
          description="Allow chats and coding sessions to be used for training."
          checked={privacy.helpImproveModels}
          onCheckedChange={(helpImproveModels) =>
            onPrivacyChange({ helpImproveModels })
          }
        />
        <SettingsRow
          label="Cookies"
          description="Essential cookies stay on. Choose the optional ones."
          borderless
        >
          <SettingsButton onClick={() => openCookieSettings()}>
            Manage
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Your data"
        description="Export, archive, or review what you have shared."
      >
        <SettingsRow label="Export data" borderless={false}>
          <SettingsButton onClick={() => void handleExport()}>
            {exporting ? "Requesting…" : "Export"}
          </SettingsButton>
        </SettingsRow>
        <SettingsRow label="Archive all chats">
          <SettingsButton
            onClick={() =>
              window.confirm("Archive all chats? You can still export later.")
            }
          >
            Archive all
          </SettingsButton>
        </SettingsRow>
        <SettingsRow label="Shared chats">
          <SettingsButton>Manage</SettingsButton>
        </SettingsRow>
        <SettingsRow label="Shared artifacts">
          <SettingsButton>Manage</SettingsButton>
        </SettingsRow>
        <SettingsRow label="Memory" description="Review saved memories.">
          <SettingsButton onClick={onGoToPersonalization}>
            Manage
          </SettingsButton>
        </SettingsRow>
        {message || error ? (
          <p
            className={
              error
                ? "border-t border-[var(--settings-hairline)] px-4 py-3 text-[13px] text-[var(--settings-danger)] sm:px-5"
                : "border-t border-[var(--settings-hairline)] px-4 py-3 text-[13px] text-[var(--settings-fg-muted)] sm:px-5"
            }
          >
            {error ?? message}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Content safety"
        description="Reduce graphic or highly sensitive material when possible."
      >
        <SettingsToggleRow
          label="Reduce sensitive content"
          checked={reduceSensitiveContent}
          onCheckedChange={onSafetyChange}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Family"
        description="Safeguards for teens, and a contact for serious safety concerns."
      >
        <SettingsRow
          label="Parental controls"
          description="Link accounts to set limits and age-appropriate access."
        >
          <SettingsButton>Add member</SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Trusted contact"
          description="Someone 18+ we can notify if you may be at risk."
          borderless
        >
          <SettingsButton>Add contact</SettingsButton>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}

/** @deprecated Use PrivacySafetySettings. */
export const PrivacySettings = PrivacySafetySettings;
