"use client";

import {
  SettingsPanelTitle,
  SettingsPillButton,
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
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Account</SettingsPanelTitle>
      <h2 className="mb-2 text-[20px] font-semibold tracking-tight">Account</h2>

      <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
        <span className="text-[14px] text-zinc-900">Log out of all devices</span>
        <SettingsPillButton onClick={onLogoutAllDevices ?? onLogout}>
          Log out
        </SettingsPillButton>
      </div>

      <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
        <span className="text-[14px] text-zinc-900">Delete your account</span>
        <button
          type="button"
          onClick={onDeleteAccount}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Delete account
        </button>
      </div>

      <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
        <span className="text-[14px] text-zinc-900">Organization ID</span>
        <button
          type="button"
          onClick={onCopyOrgId}
          title={copied ? "Copied" : "Copy organization ID"}
          className="max-w-[min(100%,22rem)] truncate rounded-full bg-zinc-100 px-3.5 py-1.5 font-mono text-[12px] leading-5 text-zinc-600 transition-colors hover:bg-zinc-200/80"
        >
          {copied ? "Copied" : orgId}
        </button>
      </div>

      <section className="mt-8">
        <h3 className="text-[15px] font-semibold text-zinc-900">
          Trusted devices
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-zinc-500">
          Devices that can control your local machine through remote sessions.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-10 text-center text-zinc-400"
                >
                  No trusted devices.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-[15px] font-semibold text-zinc-900">
          Active sessions
        </h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-500">
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
                    className="px-4 py-10 text-center text-zinc-400"
                  >
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={`${session.device}-${session.created}`}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {session.device}
                        {session.current ? (
                          <span className="rounded-full bg-[#1b67b2]/10 px-2 py-0.5 text-[11px] font-medium text-[#1b67b2]">
                            Current
                          </span>
                        ) : null}
                      </span>
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
    </div>
  );
}
