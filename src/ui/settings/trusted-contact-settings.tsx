"use client";

import { useEffect, useState } from "react";
import {
  SettingsField,
  SettingsInlineNote,
  SettingsPage,
  SettingsPanelTitle,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import type { TrustedContactSettings } from "@/lib/api/settings";

const RELATIONSHIPS = [
  "Parent",
  "Guardian",
  "Partner",
  "Sibling",
  "Friend",
  "Colleague",
  "Other",
] as const;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function TrustedContactSettingsPanel({
  value,
  onChange,
}: {
  value: TrustedContactSettings;
  onChange: (patch: Partial<TrustedContactSettings>) => void;
}) {
  const [name, setName] = useState(value.name);
  const [email, setEmail] = useState(value.email);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  useEffect(() => {
    setName(value.name);
  }, [value.name]);

  useEffect(() => {
    setEmail(value.email);
  }, [value.email]);

  const commitName = () => {
    const next = name.replace(/\s+/g, " ").trim().slice(0, 80);
    if (next !== value.name) onChange({ name: next });
  };

  const commitEmail = () => {
    const next = email.trim().toLowerCase();
    if (!next) {
      setEmailNote(null);
      if (value.email) onChange({ email: "" });
      return;
    }
    if (!isEmail(next)) {
      setEmailNote("Enter a valid email for your trusted contact.");
      return;
    }
    setEmailNote(null);
    if (next !== value.email) onChange({ email: next });
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Trusted contact</SettingsPanelTitle>

      <SettingsSection
        title="Contact"
        description="Choose one adult we can reach about this account. They must be 18 or older."
      >
        <SettingsToggleRow
          label="Trusted contact"
          description="Allow Clauxen to contact this person for this account."
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
        <div className="grid gap-3 px-3.5 py-3 sm:grid-cols-2 sm:px-4">
          <SettingsField label="Name">
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              placeholder="Their name"
              maxLength={80}
              className="cx-field w-full"
              aria-label="Trusted contact name"
            />
          </SettingsField>
          <SettingsField label="Email">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={commitEmail}
              placeholder="name@email.com"
              className="cx-field w-full"
              aria-label="Trusted contact email"
            />
          </SettingsField>
          <SettingsField label="Relationship" className="sm:col-span-2">
            <select
              value={
                RELATIONSHIPS.includes(
                  value.relationship as (typeof RELATIONSHIPS)[number],
                )
                  ? value.relationship
                  : "Friend"
              }
              onChange={(event) =>
                onChange({ relationship: event.target.value })
              }
              className="cx-field w-full sm:max-w-[16rem]"
              aria-label="Relationship"
            >
              {RELATIONSHIPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </SettingsField>
          {emailNote ? (
            <p className="text-[12.5px] text-[var(--settings-danger)] sm:col-span-2">
              {emailNote}
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="When we reach out"
        description="You can change this any time. We won't share your chats with them."
      >
        <SettingsToggleRow
          label="Safety check-in"
          description="Notify them if activity suggests you may be at risk."
          checked={value.notifyOnRisk}
          onCheckedChange={(notifyOnRisk) => onChange({ notifyOnRisk })}
        />
        <SettingsToggleRow
          label="Account recovery"
          description="They can help you get back in if you lose access."
          checked={value.notifyOnAccountRecovery}
          onCheckedChange={(notifyOnAccountRecovery) =>
            onChange({ notifyOnAccountRecovery })
          }
          borderless
        />
      </SettingsSection>

      {value.enabled && !value.email ? (
        <SettingsInlineNote>
          Add their email so we know who to contact.
        </SettingsInlineNote>
      ) : null}
    </SettingsPage>
  );
}
