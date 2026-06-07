"use client";

import {
  SettingsChevronRow,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
  SettingsValueRow,
} from "@/frontend/components/settings/settings-ui";
import type { Workspace, WorkspaceMember } from '@/frontend/lib/api/workspaces';

interface AccountSettingsProps {
  copied?: boolean;
  onCopyOrgId?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  userDisplayName?: string | null;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  workspace?: Workspace | null;
  workspaceMembers?: WorkspaceMember[];
  workspaceLoading?: boolean;
}

export function AccountSettings({
  copied = false,
  onCopyOrgId,
  userId,
  userEmail,
  userDisplayName,
  onLogout,
  onDeleteAccount,
  workspace,
  workspaceMembers = [],
  workspaceLoading,
}: AccountSettingsProps) {
  const displayName =
    userDisplayName?.trim() ||
    (userEmail ? userEmail.split("@")[0]?.replace(/\./g, " ") : null) ||
    "—";

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <section>
        <SettingsPanelTitle>Account</SettingsPanelTitle>
        <SettingsValueRow label="Name" value={displayName} />
        <SettingsChevronRow label="Email" value={userEmail ?? "—"} />
        <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-zinc-100 py-3">
          <span className="text-[14px] font-[430]">Delete account</span>
          <SettingsPillButton variant="danger" onClick={onDeleteAccount}>
            Delete
          </SettingsPillButton>
        </div>
      </section>

      {(workspace || workspaceLoading) && (
        <section className="border-t border-zinc-200 pt-6">
          <SettingsSectionHeading>Workspace</SettingsSectionHeading>
          {workspaceLoading && (
            <p className="text-[14px] text-zinc-400">Loading workspace…</p>
          )}
          {!workspaceLoading && workspace && (
            <div className="mt-2 flex flex-col gap-3">
              <SettingsValueRow label="Workspace name" value={workspace.name} borderless />
              <div className="flex min-h-[52px] items-center justify-between gap-4 py-2">
                <span className="text-[14px] font-[430]">Workspace ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-zinc-600">{workspace.id}</span>
                  {onCopyOrgId && userId && (
                    <button
                      type="button"
                      onClick={onCopyOrgId}
                      className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label="Copy organization ID"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>
              {workspaceMembers.length > 0 && (
                <ul className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
                  {workspaceMembers.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between px-3 py-2.5 text-[13px]"
                    >
                      <span className="truncate">
                        {member.display_name || member.email || member.user_id}
                      </span>
                      <span className="shrink-0 capitalize text-zinc-400">{member.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!workspaceLoading && !workspace && (
            <p className="mt-2 text-[14px] text-zinc-400">No workspace linked to this account.</p>
          )}
        </section>
      )}

      {onLogout && (
        <section className="border-t border-zinc-200 pt-6">
          <button
            type="button"
            onClick={onLogout}
            className="text-[14px] text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Log out
          </button>
        </section>
      )}
    </div>
  );
}
