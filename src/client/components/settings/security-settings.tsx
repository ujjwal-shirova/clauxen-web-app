"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Terminal } from "lucide-react";
import {
  SettingsButton,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import {
  AuthenticatorSetupDialog,
  PhoneSetupDialog,
} from "@/components/settings/mfa-setup-dialogs";
import * as settingsApi from "@/lib/api/settings-extended";

export type SecuritySettingsView = "main" | "passkeys";

type StoredPasskey = {
  id: string;
  name: string;
  addedAt: number;
};

function defaultPasskeyName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iCloud Keychain";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows Hello";
  if (/Android/.test(ua)) return "Google Password Manager";
  return "Passkey";
}

function PasskeysPanel({
  userEmail,
  onBack,
}: {
  userEmail?: string;
  onBack: () => void;
}) {
  const [passkeys, setPasskeys] = useState<StoredPasskey[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setError("This browser doesn't support passkeys.");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode(userEmail || "clauxen-user");
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "Clauxen",
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: userEmail || "user",
            displayName: userEmail || "Clauxen user",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
          },
          timeout: 60_000,
        },
      });

      if (!credential) {
        setError("Couldn't create a passkey.");
        return;
      }

      setPasskeys((prev) => [
        ...prev,
        {
          id: credential.id,
          name: defaultPasskeyName(),
          addedAt: Date.now(),
        },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        return;
      }
      setError(
        err instanceof Error ? err.message : "Couldn't add a passkey.",
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex w-full animate-in fade-in flex-col duration-200">
      <SettingsPanelTitle>Security keys and passkeys</SettingsPanelTitle>

      <div className="mb-4 flex items-center gap-1.5 border-b border-[var(--settings-hairline)] pb-3 md:hidden">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="ui-icon-button no-hover-overlay -ml-1.5 h-8 w-8 shrink-0 rounded-lg text-[var(--settings-fg)] hover:bg-[var(--settings-nav-hover-bg)]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <h3 className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.015em] text-[var(--settings-fg)]">
          Security keys & passkeys
        </h3>
      </div>

      <p className="text-[13px] leading-5 text-[var(--settings-fg-muted)]">
        Active keys and passkeys for this account.
      </p>

      {passkeys.length > 0 ? (
        <ul className="settings-card mt-4">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-3 border-b border-[var(--settings-hairline)] px-4 py-3 last:border-b-0 sm:px-5"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-[var(--settings-fg)]">
                  {passkey.name}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--settings-fg-muted)]">
                  Added {new Date(passkey.addedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPasskeys((prev) =>
                    prev.filter((item) => item.id !== passkey.id),
                  )
                }
                className="shrink-0 text-[13px] font-medium text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-3 text-[13px] text-[var(--settings-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        <SettingsButton
          variant="primary"
          disabled={adding}
          onClick={() => void handleAdd()}
        >
          {adding ? "Waiting for device…" : "Add a key or passkey"}
        </SettingsButton>
      </div>
    </div>
  );
}

interface SecuritySettingsProps {
  onLogout?: () => void;
  mfaEnabled?: boolean;
  onMfaChange?: (enabled: boolean) => void;
  userEmail?: string;
  view?: SecuritySettingsView;
  onViewChange?: (view: SecuritySettingsView) => void;
}

export function SecuritySettings({
  onLogout,
  mfaEnabled = false,
  onMfaChange,
  userEmail,
  view = "main",
  onViewChange,
}: SecuritySettingsProps) {
  const [authenticatorOpen, setAuthenticatorOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(mfaEnabled);
  const [textMessageEnabled, setTextMessageEnabled] = useState(false);

  const [lockdownMode, setLockdownMode] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [enforceCsp, setEnforceCsp] = useState(false);
  const [deviceCodeAuth, setDeviceCodeAuth] = useState(false);

  const [codexCliConnected, setCodexCliConnected] = useState(true);
  const [confirmDisconnectCli, setConfirmDisconnectCli] = useState(false);
  const [confirmLogoutOthers, setConfirmLogoutOthers] = useState(false);

  const [sessionCount, setSessionCount] = useState<number>(6);

  useEffect(() => {
    void settingsApi
      .getSecuritySettings()
      .then(({ security }) => {
        if (security.sessions && security.sessions.length > 0) {
          setSessionCount(security.sessions.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleAuthenticator = (checked: boolean) => {
    if (checked) {
      setAuthenticatorOpen(true);
    } else {
      setAuthenticatorEnabled(false);
      onMfaChange?.(textMessageEnabled);
    }
  };

  const handleToggleTextMessage = (checked: boolean) => {
    if (checked) {
      setPhoneOpen(true);
    } else {
      setTextMessageEnabled(false);
      onMfaChange?.(authenticatorEnabled);
    }
  };

  if (view === "passkeys") {
    return (
      <PasskeysPanel
        userEmail={userEmail}
        onBack={() => onViewChange?.("main")}
      />
    );
  }

  return (
    <SettingsPage>
      <SettingsPanelTitle>Security</SettingsPanelTitle>

      <SettingsSection title="Sign in" description="Password and passkeys.">
        <SettingsRow label="Password" description="Reset by email.">
          <SettingsButton
            onClick={() => {
              window.open("/auth/reset-password", "_blank", "noopener");
            }}
          >
            Set new password
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Security keys & passkeys"
          description="Phishing-resistant sign-in."
          borderless
        >
          <SettingsButton onClick={() => onViewChange?.("passkeys")}>
            Manage
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Two-step verification"
        description="A second code at sign-in."
      >
        <SettingsToggleRow
          label="Authenticator app"
          description="One-time codes from an app."
          checked={authenticatorEnabled}
          onCheckedChange={handleToggleAuthenticator}
        />
        <SettingsToggleRow
          label="Text message"
          description="6-digit codes by SMS or WhatsApp."
          checked={textMessageEnabled}
          onCheckedChange={handleToggleTextMessage}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Sessions" description="Where you're signed in.">
        {confirmLogoutOthers ? (
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <p className="text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              End {sessionCount} active sessions on other devices? This device
              stays signed in.
            </p>
            <div className="flex justify-end gap-2">
              <SettingsButton
                size="sm"
                onClick={() => setConfirmLogoutOthers(false)}
              >
                Keep
              </SettingsButton>
              <SettingsButton
                size="sm"
                variant="danger"
                onClick={() => {
                  setConfirmLogoutOthers(false);
                  onLogout?.();
                }}
              >
                Log out others
              </SettingsButton>
            </div>
          </div>
        ) : (
          <SettingsRow
            label="Active sessions"
            description={`${sessionCount} devices have accessed your account.`}
            borderless
          >
            <SettingsButton onClick={() => setConfirmLogoutOthers(true)}>
              Log out others
            </SettingsButton>
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsSection
        title="Advanced"
        description="Stronger protections with trade-offs."
      >
        <SettingsToggleRow
          label="Lockdown mode"
          description="Limit web and external features to resist prompt injection."
          checked={lockdownMode}
          onCheckedChange={setLockdownMode}
        />
        <SettingsToggleRow
          label="Developer mode"
          description="Enable experimental developer options."
          checked={developerMode}
          onCheckedChange={(val) => {
            setDeveloperMode(val);
            if (!val) setEnforceCsp(false);
          }}
        />
        {developerMode ? (
          <SettingsToggleRow
            label="Enforce CSP in developer mode"
            description="Apply production content rules to dev apps."
            checked={enforceCsp}
            onCheckedChange={setEnforceCsp}
            borderless
          />
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Connected apps"
        description="Tools signed in with Clauxen."
      >
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--settings-icon-bg)] text-[var(--settings-fg-muted)]">
              <Terminal className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[var(--settings-fg)]">
                Codex CLI
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--settings-fg-muted)]">
                {codexCliConnected ? "Connected" : "Disconnected"}
              </p>
            </div>
          </div>
          {confirmDisconnectCli ? (
            <div className="flex shrink-0 items-center gap-2">
              <SettingsButton
                size="sm"
                onClick={() => setConfirmDisconnectCli(false)}
              >
                Keep
              </SettingsButton>
              <SettingsButton
                size="sm"
                variant="danger"
                onClick={() => {
                  setCodexCliConnected(false);
                  setConfirmDisconnectCli(false);
                }}
              >
                Disconnect
              </SettingsButton>
            </div>
          ) : codexCliConnected ? (
            <SettingsButton
              size="sm"
              variant="danger"
              onClick={() => setConfirmDisconnectCli(true)}
            >
              Disconnect
            </SettingsButton>
          ) : (
            <SettingsButton size="sm" onClick={() => setCodexCliConnected(true)}>
              Connect
            </SettingsButton>
          )}
        </div>
        <SettingsToggleRow
          label="Device code sign-in"
          description="For headless environments. Never share a code."
          checked={deviceCodeAuth}
          onCheckedChange={setDeviceCodeAuth}
          borderless
        />
      </SettingsSection>

      <AuthenticatorSetupDialog
        open={authenticatorOpen}
        onOpenChange={(open) => {
          setAuthenticatorOpen(open);
        }}
        onSuccess={() => {
          setAuthenticatorEnabled(true);
          onMfaChange?.(true);
        }}
        userEmail={userEmail}
      />

      <PhoneSetupDialog
        open={phoneOpen}
        onOpenChange={(open) => {
          setPhoneOpen(open);
        }}
        onSuccess={(_phone) => {
          setTextMessageEnabled(true);
          onMfaChange?.(true);
        }}
      />
    </SettingsPage>
  );
}
