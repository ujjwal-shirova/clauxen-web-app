"use client";

import { useEffect, useState } from "react";
import { Check, Copy, LogOut, Trash2 } from "lucide-react";
import {
  SettingsButton,
  SettingsConfirmDialog,
  SettingsInlineNote,
  SettingsListItem,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsStatusBadge,
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.62 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.84 0 3.07.78 3.77 1.45l2.57-2.48A9.43 9.43 0 0 0 12 2.6a9.4 9.4 0 1 0 0 18.8c5.43 0 9.03-3.82 9.03-9.2 0-.62-.07-1.09-.16-1.56Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.67-.21.67-.47v-1.7c-2.73.6-3.3-1.3-3.3-1.3-.45-1.14-1.1-1.44-1.1-1.44-.9-.61.07-.6.07-.6 1 .07 1.52 1.02 1.52 1.02.88 1.52 2.32 1.08 2.88.83.09-.64.35-1.08.63-1.33-2.18-.25-4.47-1.09-4.47-4.85 0-1.07.38-1.95 1.01-2.63-.1-.25-.44-1.25.1-2.6 0 0 .82-.27 2.7 1a9.3 9.3 0 0 1 4.9 0c1.87-1.27 2.7-1 2.7-1 .53 1.35.2 2.35.1 2.6.62.68 1 1.56 1 2.63 0 3.77-2.3 4.6-4.48 4.84.35.3.67.9.67 1.82v2.7c0 .26.18.58.68.48A9.8 9.8 0 0 0 12 2.2Z"
      />
    </svg>
  );
}

const LINKED_PROVIDERS = [
  { id: "google", name: "Google", icon: <GoogleMark /> },
  { id: "github", name: "GitHub", icon: <GitHubMark /> },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  onOpenSecurity,
  onLogout,
  onLogoutAllDevices,
  workspace,
}: AccountSettingsProps) {
  const orgId = workspace?.id ?? userId ?? "—";
  const [nameDraft, setNameDraft] = useState(fullName || "");
  const [linked, setLinked] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{
    tone: "muted" | "danger";
    text: string;
  } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

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

      <SettingsSection
        title="Organization"
        description="Workspace identity used for sharing, billing, and support."
      >
        <SettingsRow label="Workspace">
          <span className="truncate text-[13px] text-[var(--settings-fg-muted)]">
            {workspace?.name || "Personal"}
          </span>
        </SettingsRow>
        <SettingsRow
          label="Organization ID"
          description="Share this with support when asked."
          borderless
        >
          <button
            type="button"
            onClick={onCopyOrgId}
            title={copied ? "Copied" : "Copy organization ID"}
            className="settings-btn !h-7 !min-h-7 max-w-[min(100%,20rem)] !gap-1.5 !px-2.5 font-mono !text-[11.5px]"
          >
            <span className="truncate">{orgId}</span>
            {copied ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Copy className="size-3.5 shrink-0 text-[var(--settings-fg-muted)]" aria-hidden />
            )}
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Linked accounts"
        description="Sign in faster with an account you already use."
      >
        {LINKED_PROVIDERS.map((provider) => {
          const isLinked = Boolean(linked[provider.id]);
          return (
            <SettingsListItem
              key={provider.id}
              icon={provider.icon}
              title={provider.name}
              meta={isLinked ? `Connected as ${userEmail ?? "you"}` : "Not connected"}
              badge={
                isLinked ? (
                  <SettingsStatusBadge tone="success">Linked</SettingsStatusBadge>
                ) : null
              }
              action={
                <SettingsButton
                  size="sm"
                  variant={isLinked ? "ghost" : "default"}
                  onClick={() =>
                    setLinked((prev) => ({ ...prev, [provider.id]: !isLinked }))
                  }
                >
                  {isLinked ? "Disconnect" : "Connect"}
                </SettingsButton>
              }
            />
          );
        })}
      </SettingsSection>

      <SettingsSection title="Danger zone" className="cx-set-danger">
        <SettingsRow
          label="Log out of this device"
          description="You'll need to sign in again here."
        >
          <SettingsButton size="sm" onClick={() => setLogoutOpen(true)}>
            <LogOut className="size-3.5" aria-hidden />
            Log out
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Delete account"
          description="Permanently removes your chats, files, memory, and billing history."
          borderless
        >
          <SettingsButton size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" aria-hidden />
            Delete account
          </SettingsButton>
        </SettingsRow>
        {deleteMessage ? (
          <div className="border-t border-[var(--settings-hairline)]">
            <SettingsInlineNote tone={deleteMessage.tone}>
              {deleteMessage.text}
            </SettingsInlineNote>
          </div>
        ) : null}
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
