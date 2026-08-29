"use client";

import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
  SettingsStatusBadge,
} from "@/components/settings/settings-ui";
import type { Workspace } from "@/lib/api/workspaces";

interface AccountSettingsProps {
  copied?: boolean;
  onCopyOrgId?: () => void;
  userId?: string | null;
  onLogout?: () => void;
  onLogoutAllDevices?: () => void;
  onDeleteAccount?: () => void;
  workspace?: Workspace | null;
  sessions?: Array<{
    device: string;
    location: string;
    created: string;
    updated?: string;
    current?: boolean;
  }>;
}

export function AccountSettings({
  copied = false,
  onCopyOrgId,
  userId,
  onLogout,
  onLogoutAllDevices,
  onDeleteAccount,
  workspace,
  sessions = [],
}: AccountSettingsProps) {
  const orgId = workspace?.id ?? userId ?? "—";

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Account</SettingsPanelTitle>

      <SettingsSection title="Account access">
        <SettingsRow label="Log out of all devices">
          <SettingsPillButton onClick={onLogoutAllDevices ?? onLogout}>
            Log out
          </SettingsPillButton>
        </SettingsRow>

        <SettingsRow label="Delete your account">
          <SettingsPillButton onClick={onDeleteAccount} variant="danger">
            Delete account
          </SettingsPillButton>
        </SettingsRow>

        <SettingsRow label="Organization ID" borderless>
          <button
            type="button"
            onClick={onCopyOrgId}
            title={copied ? "Copied" : "Copy organization ID"}
            className="settings-btn max-w-[min(100%,22rem)] truncate font-mono text-[12px]"
          >
            {copied ? "Copied" : orgId}
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Trusted devices"
        description="Devices that can control your local machine through remote sessions."
      >
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--settings-hairline)] text-[var(--settings-fg-muted)]">
              <th className="px-4 py-2.5 font-medium">Device</th>
              <th className="px-4 py-2.5 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={2}
                className="px-4 py-10 text-center text-[var(--settings-fg-subtle)]"
              >
                No trusted devices.
              </td>
            </tr>
          </tbody>
        </table>
      </SettingsSection>

      <SettingsSection title="Active sessions">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--settings-hairline)] text-[var(--settings-fg-muted)]">
              <th className="px-4 py-2.5 font-medium">Device</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-[var(--settings-fg-subtle)]"
                >
                  No active sessions.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr
                  key={`${session.device}-${session.created}`}
                  className="border-t border-[var(--settings-hairline)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--settings-fg)]">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {session.device}
                      {session.current ? (
                        <SettingsStatusBadge tone="success">
                          Current
                        </SettingsStatusBadge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                    {session.location}
                  </td>
                  <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                    {session.created}
                  </td>
                  <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                    {session.updated ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SettingsSection>
    </div>
  );
}
