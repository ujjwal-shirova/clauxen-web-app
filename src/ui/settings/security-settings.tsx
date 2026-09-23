"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";
import {
  SettingsButton,
  SettingsConfirmDialog,
  SettingsEmpty,
  SettingsIconTile,
  SettingsListItem,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsStatusBadge,
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
    <div className="flex w-full flex-col">
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

      <p className="px-1 text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
        Passkeys let you sign in with your fingerprint, face, or a hardware
        key instead of a password.
      </p>

      {passkeys.length > 0 ? (
        <div className="settings-card mt-3">
          {passkeys.map((passkey) => (
            <SettingsListItem
              key={passkey.id}
              icon={<Fingerprint className="size-[15px]" />}
              title={passkey.name}
              meta={`Added ${new Date(passkey.addedAt).toLocaleDateString()}`}
              action={
                <SettingsButton
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPasskeys((prev) =>
                      prev.filter((item) => item.id !== passkey.id),
                    )
                  }
                >
                  Remove
                </SettingsButton>
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <SettingsEmpty
            title="No passkeys yet"
            body="Add one from this device to skip passwords next time."
          />
        </div>
      )}

      {error ? (
        <p className="mt-2.5 px-1 text-[12.5px] text-[var(--settings-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3.5">
        <SettingsButton
          size="sm"
          variant="primary"
          disabled={adding}
          onClick={() => void handleAdd()}
        >
          <KeyRound className="size-3.5" aria-hidden />
          {adding ? "Waiting for device…" : "Add a passkey"}
        </SettingsButton>
      </div>
    </div>
  );
}

type SessionEntry = {
  id: string;
  device: string;
  kind: "desktop" | "mobile" | "cli";
  detail: string;
  when: string;
  current: boolean;
};

function describeUserAgent(ua: string | null): {
  device: string;
  kind: SessionEntry["kind"];
} {
  if (!ua) return { device: "Unknown device", kind: "desktop" };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl|node|python|clauxen/i.test(ua)
            ? "CLI"
            : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const kind: SessionEntry["kind"] =
    browser === "CLI" ? "cli" : /iPhone|Android|Mobile/.test(ua) ? "mobile" : "desktop";
  return { device: os ? `${browser} on ${os}` : browser, kind };
}

function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function generateRecoveryCodes(): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

const sessionIcon = {
  desktop: <Laptop className="size-[15px]" />,
  mobile: <Smartphone className="size-[15px]" />,
  cli: <Terminal className="size-[15px]" />,
} as const;

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
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = useState(false);

  const [signInAlerts, setSignInAlerts] = useState(true);
  const [unusualActivityAlerts, setUnusualActivityAlerts] = useState(true);
  const [emailLinks, setEmailLinks] = useState(true);

  const [lockdownMode, setLockdownMode] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [enforceCsp, setEnforceCsp] = useState(false);
  const [deviceCodeAuth, setDeviceCodeAuth] = useState(false);

  const [cliConnected, setCliConnected] = useState(true);
  const [confirmDisconnectCli, setConfirmDisconnectCli] = useState(false);
  const [confirmLogoutOthers, setConfirmLogoutOthers] = useState(false);

  const [rawSessions, setRawSessions] = useState<
    settingsApi.SecuritySettingsData["sessions"] | null
  >(null);

  useEffect(() => {
    void settingsApi
      .getSecuritySettings()
      .then(({ security }) => setRawSessions(security.sessions ?? []))
      .catch(() => setRawSessions([]));
  }, []);

  useEffect(() => setAuthenticatorEnabled(mfaEnabled), [mfaEnabled]);

  const sessions = useMemo<SessionEntry[]>(() => {
    const currentUa =
      typeof navigator !== "undefined" ? navigator.userAgent : null;
    const list = (rawSessions ?? []).slice(0, 8).map((entry, index) => {
      const { device, kind } = describeUserAgent(entry.userAgent);
      return {
        id: entry.id,
        device,
        kind,
        detail: entry.ipAddress ?? "IP hidden",
        when: relativeTime(entry.createdAt),
        current: index === 0 && entry.userAgent === currentUa,
      };
    });
    if (!list.some((item) => item.current)) {
      const { device, kind } = describeUserAgent(currentUa);
      list.unshift({
        id: "current",
        device,
        kind,
        detail: "This device",
        when: "Active now",
        current: true,
      });
    }
    return list;
  }, [rawSessions]);

  const otherSessionCount = sessions.filter((item) => !item.current).length;
  const twoStepOn = authenticatorEnabled || textMessageEnabled;
  const checks = [true, twoStepOn, signInAlerts];
  const score = checks.filter(Boolean).length;

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
      <SettingsPanelTitle>Security & login</SettingsPanelTitle>

      <div className="cx-set-hero">
        <SettingsIconTile className="!size-10 !rounded-[11px]">
          <ShieldCheck className="size-[18px]" />
        </SettingsIconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold leading-5 text-[var(--settings-fg)]">
              Security checkup
            </p>
            <SettingsStatusBadge tone={score === checks.length ? "success" : "warning"}>
              {score === checks.length ? "Protected" : "Needs attention"}
            </SettingsStatusBadge>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
            {twoStepOn
              ? "2-step verification is on. Keep your recovery codes somewhere safe."
              : "Turn on 2-step verification so a password alone can't unlock your account."}
          </p>
          <div className="cx-set-meter mt-2.5" aria-hidden>
            {checks.map((ok, index) => (
              <span key={index} data-on={ok ? "" : undefined} />
            ))}
          </div>
        </div>
        {!twoStepOn ? (
          <SettingsButton size="sm" variant="primary" onClick={() => setAuthenticatorOpen(true)}>
            Turn on
          </SettingsButton>
        ) : null}
      </div>

      <SettingsSection
        title="Sign-in methods"
        description="Ways you can get into your account."
      >
        <SettingsRow
          label="Password"
          description={userEmail ? `Signs in as ${userEmail}` : "Reset by email."}
        >
          <SettingsButton
            size="sm"
            onClick={() => {
              window.open("/auth/reset-password", "_blank", "noopener");
            }}
          >
            Change password
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Passkeys"
          description="Phishing-resistant sign-in with Face ID, Touch ID, or a security key."
        >
          <SettingsButton size="sm" onClick={() => onViewChange?.("passkeys")}>
            Manage
            <ChevronRight className="size-3.5" aria-hidden />
          </SettingsButton>
        </SettingsRow>
        <SettingsToggleRow
          label="Email sign-in links"
          description="Allow one-time magic links sent to your inbox."
          checked={emailLinks}
          onCheckedChange={setEmailLinks}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="2-step verification"
        description="Ask for a second code whenever you sign in on a new device."
      >
        <SettingsToggleRow
          label="Authenticator app"
          description="Time-based codes from 1Password, Authy, or Google Authenticator."
          checked={authenticatorEnabled}
          onCheckedChange={handleToggleAuthenticator}
        />
        <SettingsToggleRow
          label="Text message"
          description="6-digit codes by SMS."
          checked={textMessageEnabled}
          onCheckedChange={handleToggleTextMessage}
        />
        <SettingsRow
          label="Recovery codes"
          description="Single-use codes for when you lose access to your device."
          borderless
        >
          <SettingsButton
            size="sm"
            disabled={!twoStepOn}
            onClick={() => {
              setCodesCopied(false);
              setRecoveryCodes(generateRecoveryCodes());
            }}
          >
            Generate
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Where you're signed in"
        description="Devices and apps with access to your account."
        action={
          otherSessionCount > 0 ? (
            <SettingsButton size="sm" variant="ghost" onClick={() => setConfirmLogoutOthers(true)}>
              <LogOut className="size-3.5" aria-hidden />
              Log out others
            </SettingsButton>
          ) : null
        }
      >
        {rawSessions === null ? (
          <div className="flex flex-col">
            {[0, 1].map((i) => (
              <div key={i} className="cx-set-item">
                <span className="skeleton skeleton--shimmer size-8 rounded-[9px]" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="skeleton skeleton--shimmer h-3 w-32 rounded" />
                  <span className="skeleton skeleton--shimmer h-2.5 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          sessions.map((session) => (
            <SettingsListItem
              key={session.id}
              icon={sessionIcon[session.kind]}
              title={session.device}
              meta={`${session.detail} · ${session.when}`}
              badge={
                session.current ? (
                  <SettingsStatusBadge tone="success">This device</SettingsStatusBadge>
                ) : null
              }
            />
          ))
        )}
      </SettingsSection>

      <SettingsSection
        title="Security alerts"
        description="Emails sent to your account address."
      >
        <SettingsToggleRow
          label="New sign-ins"
          description="When your account is accessed from a new device or browser."
          checked={signInAlerts}
          onCheckedChange={setSignInAlerts}
        />
        <SettingsToggleRow
          label="Unusual activity"
          description="Password changes, new passkeys, and blocked sign-in attempts."
          checked={unusualActivityAlerts}
          onCheckedChange={setUnusualActivityAlerts}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Connected apps"
        description="Tools that signed in with your Clauxen account."
      >
        <SettingsListItem
          icon={<Terminal className="size-[15px]" />}
          title="Clauxen CLI"
          meta={cliConnected ? "Connected · full account access" : "Not connected"}
          action={
            cliConnected ? (
              <SettingsButton size="sm" variant="danger" onClick={() => setConfirmDisconnectCli(true)}>
                Disconnect
              </SettingsButton>
            ) : (
              <SettingsButton size="sm" onClick={() => setCliConnected(true)}>
                Connect
              </SettingsButton>
            )
          }
        />
        <SettingsToggleRow
          label="Device code sign-in"
          description="For headless machines. Never share a code you didn't request."
          checked={deviceCodeAuth}
          onCheckedChange={setDeviceCodeAuth}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Advanced protection"
        description="Stronger safeguards that trade off some features."
      >
        <SettingsToggleRow
          label="Lockdown mode"
          description="Limit web browsing and external tools to resist prompt injection."
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
          borderless={!developerMode}
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

      <SettingsConfirmDialog
        open={confirmLogoutOthers}
        onOpenChange={setConfirmLogoutOthers}
        title="Log out other sessions?"
        description={`This ends ${otherSessionCount} session${otherSessionCount === 1 ? "" : "s"} on other devices. You'll stay signed in here.`}
        confirmLabel="Log out others"
        tone="danger"
        onConfirm={() => {
          setConfirmLogoutOthers(false);
          onLogout?.();
        }}
      />

      <SettingsConfirmDialog
        open={confirmDisconnectCli}
        onOpenChange={setConfirmDisconnectCli}
        title="Disconnect Clauxen CLI?"
        description="Running terminal sessions will stop and need to sign in again."
        confirmLabel="Disconnect"
        tone="danger"
        onConfirm={() => {
          setCliConnected(false);
          setConfirmDisconnectCli(false);
        }}
      />

      <SettingsConfirmDialog
        open={recoveryCodes !== null}
        onOpenChange={(open) => {
          if (!open) setRecoveryCodes(null);
        }}
        title="Recovery codes"
        description="Each code works once. Store them in a password manager — generating new codes invalidates old ones."
        confirmLabel="Done"
        hideCancel
        onConfirm={() => setRecoveryCodes(null)}
      >
        <div className="grid grid-cols-2 gap-1.5 rounded-[10px] bg-[var(--settings-icon-bg)] p-2.5 font-mono text-[12.5px] leading-5 text-[var(--settings-fg)]">
          {(recoveryCodes ?? []).map((code) => (
            <span key={code} className="text-center">
              {code}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start text-[12px] font-medium text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
          onClick={() => {
            void navigator.clipboard
              .writeText((recoveryCodes ?? []).join("\n"))
              .then(() => setCodesCopied(true))
              .catch(() => undefined);
          }}
        >
          <Copy className="size-3.5" aria-hidden />
          {codesCopied ? "Copied to clipboard" : "Copy codes"}
        </button>
      </SettingsConfirmDialog>

      <AuthenticatorSetupDialog
        open={authenticatorOpen}
        onOpenChange={setAuthenticatorOpen}
        onSuccess={() => {
          setAuthenticatorEnabled(true);
          onMfaChange?.(true);
        }}
        userEmail={userEmail}
      />

      <PhoneSetupDialog
        open={phoneOpen}
        onOpenChange={setPhoneOpen}
        onSuccess={(_phone) => {
          setTextMessageEnabled(true);
          onMfaChange?.(true);
        }}
      />
    </SettingsPage>
  );
}
