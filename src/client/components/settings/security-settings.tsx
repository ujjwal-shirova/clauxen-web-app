"use client";

import { useEffect, useState } from "react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import * as settingsApi from "@/lib/api/settings-extended";

interface SecuritySettingsProps {
  onLogout?: () => void;
  mfaEnabled?: boolean;
  onMfaChange?: (enabled: boolean) => void;
}

export function SecuritySettings({
  onLogout,
  mfaEnabled = false,
  onMfaChange,
}: SecuritySettingsProps) {
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      eventType: string;
      ipAddress: string | null;
      createdAt: string;
    }>
  >([]);
  const [providers, setProviders] = useState<
    Array<{ id: string; provider: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void settingsApi
      .getSecuritySettings()
      .then(({ security }) => {
        setSessions(security.sessions);
        setProviders(security.linkedProviders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Security</SettingsPanelTitle>

      <SettingsSection title="Account protection">
        <SettingsToggleRow
          label="Multi-factor authentication"
          description="Require a second factor when signing in to your Clauxen account."
          checked={mfaEnabled}
          onCheckedChange={(v) => onMfaChange?.(v)}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Recent sign-in activity">
        <div className="px-[var(--settings-row-pad-x)] py-2">
          {loading ? (
            <p className="py-3 text-sm text-[var(--settings-fg-muted)]">
              Loading…
            </p>
          ) : sessions.length === 0 ? (
            <p className="py-3 text-sm text-[var(--settings-fg-muted)]">
              No recent activity recorded.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--settings-hairline)]">
              {sessions.map((session) => (
                <li key={session.id} className="py-3 text-sm">
                  <p className="font-medium">{session.eventType}</p>
                  <p className="mt-0.5 text-xs text-[var(--settings-fg-muted)]">
                    {session.ipAddress ?? "Unknown IP"} ·{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Linked providers">
        <div className="px-[var(--settings-row-pad-x)] py-2">
          {providers.length === 0 ? (
            <p className="py-3 text-sm text-[var(--settings-fg-muted)]">
              No third-party sign-in providers linked.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--settings-hairline)]">
              {providers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span>{p.provider}</span>
                  <span className="text-[var(--settings-fg-muted)]">
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="This device">
        <SettingsRow label="Log out of this device" borderless>
          <SettingsPillButton onClick={onLogout}>Log out</SettingsPillButton>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
