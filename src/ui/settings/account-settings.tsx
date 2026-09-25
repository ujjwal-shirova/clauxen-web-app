"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Laptop, Trash2 } from "lucide-react";
import {
  SettingsButton,
  SettingsConfirmDialog,
  SettingsInlineNote,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
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
  onOpenSecurity?: () => void;
  onLogout?: () => void;
  onLogoutAllDevices?: () => void;
  workspace?: Workspace | null;
  /** @deprecated Sessions moved to Security & login. */
  sessions?: Array<{
    device: string;
    location: string;
    created: string;
    updated?: string;
    current?: boolean;
  }>;
}

export function AccountSettings({
  userId,
  userEmail,
  avatarUrl,
  onAvatarUpdated,
  fullName,
  onFullNameChange,
  onOpenSecurity,
  onLogout,
  onLogoutAllDevices,
}: AccountSettingsProps) {
  const [nameDraft, setNameDraft] = useState(fullName || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    tone: "muted" | "danger";
    text: string;
  } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [supportAccess, setSupportAccess] = useState(false);
  const [deviceLimit, setDeviceLimit] = useState(3);
  const [sessions, setSessions] = useState<
    settingsApi.SecuritySettingsData["sessions"] | null
  >(null);
  const [userIdCopied, setUserIdCopied] = useState(false);

  useEffect(() => {
    void settingsApi
      .getSecuritySettings()
      .then(({ security }) => setSessions(security.sessions ?? []))
      .catch(() => setSessions([]));
  }, []);

  const devices = useMemo(() => {
    const currentUa = typeof navigator !== "undefined" ? navigator.userAgent : "";
    return (sessions ?? []).map((entry, index) => ({
      id: entry.id,
      name: /Mac/i.test(entry.userAgent ?? "")
        ? "macOS"
        : /Windows/i.test(entry.userAgent ?? "")
          ? "Windows"
          : /Android/i.test(entry.userAgent ?? "")
            ? "Android"
            : /iPhone|iPad/i.test(entry.userAgent ?? "")
              ? "iOS"
              : "Browser",
      when:
        index === 0 && entry.userAgent === currentUa
          ? "Now"
          : new Date(entry.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
      location: entry.ipAddress || "Unknown",
      current: index === 0 && entry.userAgent === currentUa,
    }));
  }, [sessions]);

  useEffect(() => setNameDraft(fullName || ""), [fullName]);

  const displayName = nameDraft.trim() || userEmail?.split("@")[0] || "You";
  const nameDirty = nameDraft.trim() !== (fullName || "").trim();

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const { request } = await settingsApi.requestDataDeletion();
      setDeleteMessage({
        tone: "muted",
        text: `Deletion scheduled (ref ${request.id.slice(0, 8)}). We'll email you when it's complete.`,
      });
      setDeleteOpen(false);
    } catch (err) {
      setDeleteMessage({
        tone: "danger",
        text: err instanceof Error ? err.message : "Deletion request failed.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Account</SettingsPanelTitle>

      <SettingsSection title="Profile">
        <div className="flex items-center gap-4 px-1 py-3">
          <ProfileAvatarUpload
            name={displayName}
            avatarUrl={avatarUrl}
            onUpdated={onAvatarUpdated}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[12px] leading-4 text-[var(--settings-fg-muted)]">
              Preferred name
            </label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDirty) onFullNameChange(nameDraft.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Your name"
              className="cx-field max-w-[280px]"
              autoComplete="name"
              maxLength={120}
            />
            <p className="mt-2 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              Add a photo from the portrait, or keep the initial.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Account security">
        <SettingsRow label="Email" description={userEmail || "Not signed in"}>
          <SettingsButton size="sm" onClick={onOpenSecurity}>
            Manage emails
          </SettingsButton>
        </SettingsRow>
        <SettingsRow label="Password" description="Set a password for your account">
          <SettingsButton size="sm" onClick={onOpenSecurity}>
            Add password
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Two-step verification"
          description="Add another layer of security to your account"
        >
          <SettingsButton size="sm" onClick={onOpenSecurity}>
            Add verification method
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Passkeys"
          description="Sign in with on-device biometric authentication"
          borderless
        >
          <SettingsButton size="sm" onClick={onOpenSecurity}>
            Add passkey
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsToggleRow
          label="Support access"
          description="Grant Clauxen support temporary access to help troubleshoot problems or recover content. You can revoke access anytime."
          checked={supportAccess}
          onCheckedChange={setSupportAccess}
        />
        <SettingsRow
          label="Delete my account"
          description="Permanently delete your account. You'll no longer be able to access your chats or files."
          borderless
        >
          <SettingsButton size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete my account
          </SettingsButton>
        </SettingsRow>
        {deleteMessage ? (
          <SettingsInlineNote tone={deleteMessage.tone}>
            {deleteMessage.text}
          </SettingsInlineNote>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Devices">
        <SettingsRow
          label="Log out of all devices"
          description="Log out of active sessions on all your devices, other than this one"
        >
          <SettingsButton size="sm" variant="danger" onClick={() => setLogoutOpen(true)}>
            Log out of all devices
          </SettingsButton>
        </SettingsRow>
        <div className="overflow-x-auto px-4 py-3 sm:px-5">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr className="text-[12px] text-[var(--settings-fg-subtle)]">
                <th className="pb-2 font-medium">Device Name</th>
                <th className="pb-2 font-medium">Last Active</th>
                <th className="pb-2 font-medium">Location</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, deviceLimit).map((device) => (
                <tr key={device.id} className="border-t border-[var(--settings-hairline)]">
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <Laptop className="size-4 text-[var(--settings-fg-muted)]" aria-hidden />
                      <span>
                        <span className="block font-medium">{device.name}</span>
                        {device.current ? (
                          <span className="text-[12px] text-[var(--link)]">This Device</span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-[var(--settings-fg-muted)]">{device.when}</td>
                  <td className="py-3 pr-3 text-[var(--settings-fg-muted)]">{device.location}</td>
                  <td className="py-3 text-right">
                    {device.current ? null : (
                      <SettingsButton
                        size="sm"
                        onClick={() =>
                          setSessions((prev) =>
                            (prev ?? []).filter((entry) => entry.id !== device.id),
                          )
                        }
                      >
                        Log out
                      </SettingsButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {devices.length > deviceLimit ? (
            <button
              type="button"
              className="mt-2 text-[13px] text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
              onClick={() => setDeviceLimit((count) => count + 3)}
            >
              ↓ Load {Math.min(3, devices.length - deviceLimit)} more devices
            </button>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title="User ID">
        <SettingsRow label="User ID" borderless>
          <button
            type="button"
            className="inline-flex max-w-full items-center gap-2 font-mono text-[12.5px] text-[var(--settings-fg-muted)]"
            onClick={() => {
              if (!userId) return;
              void navigator.clipboard.writeText(userId);
              setUserIdCopied(true);
            }}
          >
            <span className="truncate">{userId || "—"}</span>
            {userIdCopied ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Copy className="size-3.5 shrink-0" aria-hidden />
            )}
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Log out of Clauxen?"
        description={`You're signed in as ${userEmail ?? "this account"}.`}
        confirmLabel="Log out"
        onConfirm={() => {
          setLogoutOpen(false);
          (onLogout ?? onLogoutAllDevices)?.();
        }}
      />

      <SettingsConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="This permanently deletes your account and all associated data after a 14-day grace period. This can't be undone."
        confirmLabel="Delete account"
        tone="danger"
        busy={deleting}
        confirmPhrase="DELETE"
        onConfirm={handleDeleteAccount}
      />
    </SettingsPage>
  );
}
