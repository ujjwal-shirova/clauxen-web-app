"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
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
}: AccountSettingsProps) {
  const [nameDraft, setNameDraft] = useState(fullName || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    tone: "muted" | "danger";
    text: string;
  } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);

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
        <div className="flex items-center gap-4 px-4 py-4">
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
              aria-label="Preferred name"
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
        <SettingsRow
          label="Sign-in methods"
          description="Manage passwords, passkeys, and two-step verification."
        >
          <SettingsButton onClick={onOpenSecurity}>Manage</SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Support & account deletion">
        <SettingsToggleRow
          label="Support access"
          description="Temporary support access is not available yet."
          checked={false}
          disabled
          onCheckedChange={() => {}}
        />
        <SettingsRow
          label="Delete my account"
          description="Permanently delete your account. You'll no longer be able to access your chats or files."
          borderless
        >
          <SettingsButton
            size="sm"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
          >
            Delete my account
          </SettingsButton>
        </SettingsRow>
        {deleteMessage ? (
          <SettingsInlineNote tone={deleteMessage.tone}>
            {deleteMessage.text}
          </SettingsInlineNote>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Sessions">
        <SettingsRow
          label="Active devices"
          description="Review where you’re signed in and revoke individual sessions."
        >
          <SettingsButton onClick={onOpenSecurity}>Manage</SettingsButton>
        </SettingsRow>
        <SettingsRow label="Log out of this device">
          <SettingsButton onClick={() => setLogoutOpen(true)}>
            Log out
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="User ID">
        <SettingsRow label="User ID" borderless>
          <button
            type="button"
            aria-label={userIdCopied ? "User ID copied" : "Copy user ID"}
            disabled={!userId}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-focus-ring)] inline-flex max-w-full items-center gap-2 font-mono text-[12.5px] text-[var(--settings-fg-muted)]"
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
        description="This ends your session on this device."
        confirmLabel="Log out"
        onConfirm={() => {
          setLogoutOpen(false);
          onLogout?.();
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
