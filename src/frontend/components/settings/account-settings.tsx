"use client";

import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
  SettingsValueRow,
} from "@/frontend/components/settings/settings-ui";
import type { Workspace, WorkspaceMember } from "@/frontend/lib/api/workspaces";

interface AccountSettingsProps {
  copied?: boolean;
  onCopyOrgId?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  userDisplayName?: string | null;
  onLogout?: () => void;
  onLogoutAllDevices?: () => void;
  onDeleteAccount?: () => void;
  workspace?: Workspace | null;
  workspaceMembers?: WorkspaceMember[];
  workspaceLoading?: boolean;
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
  userEmail,
  userDisplayName,
  onLogout,
  onLogoutAllDevices,
  onDeleteAccount,
  workspace,
  workspaceMembers = [],
  workspaceLoading,
  sessions = [],
}: AccountSettingsProps) {
  const displayName =
    userDisplayName?.trim() ||
    (userEmail ? userEmail.split("@")[0]?.replace(/\./g, " ") : null) ||
    "—";

  const orgId = workspace?.id ?? userId ?? "—";

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Account</SettingsPanelTitle>
      <h2 className="text-[20px] font-semibold tracking-tight">Account</h2>

      <section>
        <SettingsValueRow label="Name" value={displayName} />
        <SettingsValueRow label="Email" value={userEmail ?? "—"} />

        <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
          <span className="text-[14px] font-[430]">Log out of all devices</span>
          <SettingsPillButton onClick={onLogoutAllDevices ?? onLogout}>
            Log out
          </SettingsPillButton>
        </div>

        <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
          <span className="text-[14px] font-[430]">Delete your account</span>
          <button
            type="button"
            onClick={onDeleteAccount}
            className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Delete account
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-zinc-500">
            Organization ID
          </p>
          <button
            type="button"
            onClick={onCopyOrgId}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left font-mono text-[13px] text-zinc-600 transition-colors hover:bg-zinc-100"
            title="Copy organization ID"
          >
            <span className="truncate">{orgId}</span>
            <span className="ml-3 shrink-0 text-[12px] text-zinc-400">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        </div>
      </section>

      <section>
        <SettingsSectionHeading>Trusted devices</SettingsSectionHeading>
        <p className="mb-3 text-[13px] text-zinc-500">
          Devices that can control your local machine through remote sessions.
        </p>
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No trusted devices.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SettingsSectionHeading>Active sessions</SettingsSectionHeading>
        <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
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
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No active sessions listed yet.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={`${session.device}-${session.created}`}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {session.device}
                      {session.current ? (
                        <span className="ml-2 rounded-full bg-[#1b67b2]/10 px-2 py-0.5 text-[11px] font-medium text-[#1b67b2]">
                          Current
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {session.location}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {session.created}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {session.updated ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(workspace || workspaceLoading) && (
        <section className="border-t border-zinc-200 pt-6">
          <SettingsSectionHeading>Workspace</SettingsSectionHeading>
          {workspaceLoading && (
            <p className="text-[14px] text-zinc-400">Loading workspace…</p>
          )}
          {!workspaceLoading && workspace && (
            <div className="mt-2 flex flex-col gap-1">
              <SettingsValueRow
                label="Workspace name"
                value={workspace.name}
                borderless
              />
              <SettingsValueRow
                label="Members"
                value={String(workspaceMembers.length)}
                borderless
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
