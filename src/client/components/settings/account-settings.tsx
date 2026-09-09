"use client";

import { useEffect, useState } from "react";
import {
  SettingsButton,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsStatusBadge,
  SettingsTable,
} from "@/components/settings/settings-ui";
import { ProfileAvatarUpload } from "@/components/settings/profile-avatar-upload";
import type { UserProfile } from "@/lib/api/profile";
import type { Workspace } from "@/lib/api/workspaces";
import * as settingsApi from "@/lib/api/settings-extended";

interface AccountSettingsProps {
  copied?: boolean;
  onCopyOrgId?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  onAvatarUpdated?: (profile: UserProfile) => void;
  fullName: string;
  onFullNameChange: (value: string) => void;
  onLogout?: () => void;
  onLogoutAllDevices?: () => void;
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
  userEmail,
  avatarUrl,
  onAvatarUpdated,
  fullName,
  onFullNameChange,
  onLogout,
  onLogoutAllDevices,
  workspace,
  sessions = [],
}: AccountSettingsProps) {
  const orgId = workspace?.id ?? userId ?? "—";
  const [nameDraft, setNameDraft] = useState(fullName || "");
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => setNameDraft(fullName || ""), [fullName]);

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Request account deletion? This queues permanent deletion of your data.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const { request } = await settingsApi.requestDataDeletion();
      setDeleteMessage(`Deletion requested (${request.id.slice(0, 8)}…).`);
    } catch (err) {
      setDeleteMessage(
        err instanceof Error ? err.message : "Deletion request failed.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Account</SettingsPanelTitle>

      <SettingsSection title="Profile" description="How you appear in Clauxen.">
        <SettingsRow label="Avatar">
          <ProfileAvatarUpload
            name={nameDraft || userEmail || "U"}
            avatarUrl={avatarUrl}
            onUpdated={onAvatarUpdated}
            size="md"
          />
        </SettingsRow>
        <SettingsRow label="Full name">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => onFullNameChange(nameDraft.trim())}
            placeholder="Your name"
            className="settings-field max-w-[20rem]"
            autoComplete="name"
            maxLength={120}
          />
        </SettingsRow>
        <SettingsRow label="Email" borderless>
          <span className="truncate text-[14px] text-[var(--settings-fg-muted)]">
            {userEmail || "—"}
          </span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Organization"
        description="Workspace identity for sharing and support."
      >
        <SettingsRow label="Organization ID" borderless>
          <button
            type="button"
            onClick={onCopyOrgId}
            title={copied ? "Copied" : "Copy organization ID"}
            className="settings-btn max-w-[min(100%,22rem)] truncate font-mono !text-[12px]"
          >
            {copied ? "Copied" : orgId}
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Sessions"
        description="Devices signed in to your account."
        action={
          <SettingsButton size="sm" onClick={onLogoutAllDevices ?? onLogout}>
            Log out others
          </SettingsButton>
        }
        card={false}
      >
        <SettingsTable
          head={
            <tr>
              <th className="px-4 py-2.5 font-medium">Device</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Last active</th>
            </tr>
          }
        >
          {sessions.length === 0 ? (
            <tr>
              <td
                colSpan={3}
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
                  {session.updated ?? session.created}
                </td>
              </tr>
            ))
          )}
        </SettingsTable>
      </SettingsSection>

      <SettingsSection
        title="Danger zone"
        description="Leaving signs you out everywhere. Deletion is permanent."
      >
        <SettingsRow label="Log out everywhere">
          <SettingsButton onClick={onLogoutAllDevices ?? onLogout}>
            Log out
          </SettingsButton>
        </SettingsRow>
        <SettingsRow label="Delete account and data" borderless>
          <SettingsButton variant="danger" onClick={() => void handleDeleteAccount()}>
            {deleting ? "Requesting…" : "Delete"}
          </SettingsButton>
        </SettingsRow>
        {deleteMessage ? (
          <p className="border-t border-[var(--settings-hairline)] px-4 py-3 text-[13px] text-[var(--settings-fg-muted)] sm:px-5">
            {deleteMessage}
          </p>
        ) : null}
      </SettingsSection>
    </SettingsPage>
  );
}
