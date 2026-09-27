"use client";

import { useEffect, useState } from "react";
import {
  SettingsButton,
  SettingsField,
  SettingsInlineNote,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import type { ParentalControlsSettings } from "@/lib/api/settings";

const CONTENT_FILTERS = ["Standard", "Strict"] as const;
const DAILY_LIMITS = [
  "Unlimited",
  "30 minutes",
  "1 hour",
  "2 hours",
  "4 hours",
] as const;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ParentalControlsSettingsPanel({
  value,
  onChange,
}: {
  value: ParentalControlsSettings;
  onChange: (patch: Partial<ParentalControlsSettings>) => void;
}) {
  const [teenEmail, setTeenEmail] = useState(value.teenEmail);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    setTeenEmail(value.teenEmail);
  }, [value.teenEmail]);

  const commitEmail = () => {
    const next = teenEmail.trim().toLowerCase();
    if (!next) {
      setEmailNote(null);
      if (value.teenEmail) onChange({ teenEmail: "" });
      return;
    }
    if (!isEmail(next)) {
      setEmailNote("Enter a valid email for the teen account.");
      return;
    }
    setEmailNote(null);
    if (next !== value.teenEmail) onChange({ teenEmail: next });
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Parental Control</SettingsPanelTitle>

      <SettingsSection
        title="Family"
        description="You need to be 18 or older to manage a teen account."
      >
        <SettingsToggleRow
          label="Parental controls"
          description="Apply limits and content filters to a linked teen."
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
        <div className="px-3.5 py-3 sm:px-4">
          <SettingsField
            label="Teen account email"
            hint="We'll use this to link the account you manage."
          >
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={teenEmail}
              onChange={(event) => setTeenEmail(event.target.value)}
              onBlur={commitEmail}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              placeholder="teen@email.com"
              className="cx-field w-full"
              aria-label="Teen account email"
            />
          </SettingsField>
          {emailNote ? (
            <p className="mt-2 text-[12.5px] text-[var(--settings-danger)]">
              {emailNote}
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Limits"
        description="These apply when parental controls are on."
      >
        <SettingsRow
          label="Content filter"
          description="Strict hides more mature topics and image results."
        >
          <div className="flex flex-wrap justify-end gap-1.5">
            {CONTENT_FILTERS.map((option) => {
              const active = value.contentFilter === option;
              return (
                <SettingsButton
                  key={option}
                  size="sm"
                  variant={active ? "primary" : "default"}
                  onClick={() => onChange({ contentFilter: option })}
                >
                  {option}
                </SettingsButton>
              );
            })}
          </div>
        </SettingsRow>
        <SettingsRow
          label="Daily time"
          description="How long the teen account can use Clauxen each day."
        >
          <label className="sr-only" htmlFor="parental-daily-limit">
            Daily time
          </label>
          <select
            id="parental-daily-limit"
            value={
              DAILY_LIMITS.includes(
                value.dailyLimit as (typeof DAILY_LIMITS)[number],
              )
                ? value.dailyLimit
                : "Unlimited"
            }
            onChange={(event) => onChange({ dailyLimit: event.target.value })}
            className="cx-field !h-8 !w-auto !min-w-[8.5rem] !px-2.5"
          >
            {DAILY_LIMITS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </SettingsRow>
        <SettingsToggleRow
          label="Quiet hours"
          description="Pause new chats overnight for the linked account."
          checked={value.quietHoursEnabled}
          onCheckedChange={(quietHoursEnabled) =>
            onChange({ quietHoursEnabled })
          }
        />
        <SettingsToggleRow
          label="Block image generation"
          description="Turn off image creation on the teen account."
          checked={value.blockImageGeneration}
          onCheckedChange={(blockImageGeneration) =>
            onChange({ blockImageGeneration })
          }
        />
        <SettingsToggleRow
          label="Approve shared chats"
          description="Shared links stay private until you allow them."
          checked={value.requireApprovalForSharing}
          onCheckedChange={(requireApprovalForSharing) =>
            onChange({ requireApprovalForSharing })
          }
          borderless
        />
      </SettingsSection>

      {!value.enabled ? (
        <SettingsInlineNote>
          Controls stay saved and start applying when you turn parental controls on.
        </SettingsInlineNote>
      ) : null}
    </SettingsPage>
  );
}
