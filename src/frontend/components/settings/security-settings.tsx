"use client";

import { useEffect, useState } from "react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
} from "@/frontend/components/settings/settings-ui";
import * as settingsApi from "@/frontend/lib/api/settings-extended";

interface SecuritySettingsProps {
  onLogout?: () => void;
}

export function SecuritySettings({ onLogout }: SecuritySettingsProps) {
  const [sessions, setSessions] = useState<
    Array<{ id: string; eventType: string; ipAddress: string | null; createdAt: string }>
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
    <div className="flex animate-in fade-in flex-col gap-6 duration-300 text-zinc-900">
      <SettingsPanelTitle>Security</SettingsPanelTitle>

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

      <section className="border-t border-zinc-100 pt-4">
        <SettingsSectionHeading>Linked providers</SettingsSectionHeading>
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-500">No third-party connectors linked.</p>
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

      <section className="flex flex-col gap-3 border-t border-zinc-100 pt-6">
        <div className="flex min-h-[60px] items-center justify-between gap-4 py-2">
          <span className="text-[14px] font-[430]">Log out of this device</span>
          <SettingsPillButton onClick={onLogout}>Log out</SettingsPillButton>
        </div>
      </section>
    </div>
  );
}
