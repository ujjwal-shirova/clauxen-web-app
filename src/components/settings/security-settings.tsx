"use client";

import { useEffect, useState } from "react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
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
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Security</SettingsPanelTitle>
      <h2 className="text-[20px] font-semibold tracking-tight">
        Security and login
      </h2>

      <section>
        <SettingsToggleRow
          label="Multi-factor authentication"
          description="Require a second factor when signing in to your Clauxen account."
          checked={mfaEnabled}
          onCheckedChange={(v) => onMfaChange?.(v)}
          borderless
        />
      </section>

      <section>
        <SettingsSectionHeading>Recent sign-in activity</SettingsSectionHeading>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent activity recorded.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sessions.map((session) => (
              <li key={session.id} className="py-3 text-sm">
                <p className="font-medium">{session.eventType}</p>
                <p className="text-xs text-zinc-500">
                  {session.ipAddress ?? "Unknown IP"} ·{" "}
                  {new Date(session.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SettingsSectionHeading>Linked providers</SettingsSectionHeading>
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No third-party sign-in providers linked.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {providers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span>{p.provider}</span>
                <span className="text-zinc-500">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex min-h-[56px] items-center justify-between gap-4 border-t border-zinc-100 pt-6">
        <span className="text-[14px]">Log out of this device</span>
        <SettingsPillButton onClick={onLogout}>Log out</SettingsPillButton>
      </div>
    </div>
  );
}
