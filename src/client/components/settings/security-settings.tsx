"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SettingsPanelTitle } from "@/components/settings/settings-ui";
import {
  AuthenticatorSetupDialog,
  PhoneSetupDialog,
} from "@/components/settings/mfa-setup-dialogs";
import * as settingsApi from "@/lib/api/settings-extended";

interface SecuritySettingsProps {
  onLogout?: () => void;
  mfaEnabled?: boolean;
  onMfaChange?: (enabled: boolean) => void;
  userEmail?: string;
}

export function SecuritySettings({
  onLogout,
  mfaEnabled = false,
  onMfaChange,
  userEmail,
}: SecuritySettingsProps) {
  // MFA states
  const [authenticatorOpen, setAuthenticatorOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(mfaEnabled);
  const [textMessageEnabled, setTextMessageEnabled] = useState(false);

  // Security toggles
  const [lockdownMode, setLockdownMode] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [enforceCsp, setEnforceCsp] = useState(false);
  const [deviceCodeAuth, setDeviceCodeAuth] = useState(false);

  // Codex CLI connection state
  const [codexCliConnected, setCodexCliConnected] = useState(true);

  // Dynamic session count from backend
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

  return (
    <div
      role="tabpanel"
      aria-labelledby="radix-_r_pb_-trigger-Security"
      tabIndex={0}
      className="flex w-full flex-col overflow-y-auto px-4 py-1 text-[14px] leading-5 text-[var(--settings-fg)] outline-none"
    >
      <SettingsPanelTitle>Security and login</SettingsPanelTitle>

      {/* =====================================================================
          Section 1: Main Header & Primary Sign-In Methods (Password, Passkeys)
          ===================================================================== */}
      <section className="relative mb-4 text-[14px] leading-5">
        {/* Section title */}
        <div className="flex min-h-[60px] items-start border-b border-black/[0.08] py-3 dark:border-white/10">
          <div className="w-full">
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
                Security & login
              </h3>
            </div>
          </div>
        </div>

        {/* Row: Password */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <button
              type="button"
              onClick={() => {
                window.alert("Password change form or reset link will be sent to your email.");
              }}
              className="group cursor-pointer flex w-full items-center justify-between text-left transition-colors"
            >
              <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                Password
              </div>
              <div className="flex min-h-[38px] items-center text-[14px] text-[rgb(93,93,93)] dark:text-zinc-400">
                <span className="mr-1 text-[14px] font-normal whitespace-nowrap">
                  Add
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(93,93,93)] transition-transform group-hover:translate-x-0.5 dark:text-zinc-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Row: Security keys & passkeys */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <button
              type="button"
              onClick={() => {
                window.alert("Hardware security key / passkey registration dialog.");
              }}
              className="group cursor-pointer flex w-full items-center justify-between text-left transition-colors"
            >
              <div className="pr-4">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Security keys & passkeys
                </div>
                <p className="mt-1 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-pretty">
                  Use hardware security keys or passkeys to sign in. These
                  phishing-resistant methods provide stronger protection than
                  passwords.
                </p>
              </div>
              <div className="flex min-h-[38px] shrink-0 items-center text-[14px] text-[rgb(93,93,93)] dark:text-zinc-400">
                <span className="mr-1 text-[14px] font-normal whitespace-nowrap">
                  Add
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(93,93,93)] transition-transform group-hover:translate-x-0.5 dark:text-zinc-400" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 2: Multi-factor authentication (MFA)
          ===================================================================== */}
      <div className="flex flex-col text-[14px] leading-5">
        <h3 className="mb-1.5 mt-6 text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
          Multi-factor authentication (MFA)
        </h3>

        {/* MFA: Authenticator app */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Authenticator app
                </div>
                <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  Use one-time codes from an authenticator app.
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Switch
                  checked={authenticatorEnabled}
                  onCheckedChange={handleToggleAuthenticator}
                  className="settings-switch"
                  aria-label="Authenticator app MFA"
                />
              </div>
            </div>
          </div>
        </div>

        {/* MFA: Text message */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Text message
                </div>
                <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  Get 6-digit verification codes by SMS or WhatsApp based on your
                  country code.
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Switch
                  checked={textMessageEnabled}
                  onCheckedChange={handleToggleTextMessage}
                  className="settings-switch"
                  aria-label="Text message MFA"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          Section 3: Sessions
          ===================================================================== */}
      <div className="flex flex-col text-[14px] leading-5">
        <h4 className="mb-1.5 mt-6 text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
          Sessions
        </h4>

        <div className="flex min-h-[60px] items-center border-y border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Do you want to log out of other sessions?")) {
                  onLogout?.();
                }
              }}
              className="group cursor-pointer flex w-full items-center justify-between text-left transition-colors"
            >
              <div className="pr-4">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Active sessions
                </div>
                <div className="mb-1 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  View all devices that have accessed your account. You can
                  review active sessions, remove trusted devices, or use Log out
                  all to end all sessions.
                </div>
              </div>
              <div className="flex min-h-[38px] shrink-0 items-center text-[14px] text-[rgb(93,93,93)] dark:text-zinc-400">
                <span className="mr-1 text-[14px] font-normal tabular-nums whitespace-nowrap">
                  {sessionCount}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(93,93,93)] transition-transform group-hover:translate-x-0.5 dark:text-zinc-400" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          Section 4: Advanced security
          ===================================================================== */}
      <div className="flex flex-col text-[14px] leading-5">
        <h4 className="mb-1.5 mt-6 text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
          Advanced security
        </h4>

        {/* Row: Advanced account security */}
        <div className="flex min-h-[60px] items-center border-y border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <button
              type="button"
              onClick={() => {
                window.alert("Advanced account security enrollment wizard.");
              }}
              className="group cursor-pointer flex w-full items-center justify-between text-left transition-colors"
            >
              <div className="pr-4">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Advanced account security
                </div>
                <div className="mb-1 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  Adds the highest level of account security by requiring
                  stronger sign-in methods and applying stricter protections to
                  help prevent unauthorized access.
                </div>
              </div>
              <div className="flex min-h-[38px] shrink-0 items-center text-[14px] text-[rgb(93,93,93)] dark:text-zinc-400">
                <span className="mr-1 text-[14px] font-normal whitespace-nowrap">
                  Enroll
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(93,93,93)] transition-transform group-hover:translate-x-0.5 dark:text-zinc-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Row: Lockdown mode */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Lockdown mode
                </div>
                <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  Helps protect sensitive data from prompt-injection attacks by
                  limiting features that can connect to the web or external
                  services.{" "}
                  <a
                    href="https://help.openai.com/en/articles/20001061-lockdown-mode"
                    target="_blank"
                    rel="noreferrer"
                    className="clickable-label cursor-pointer text-[rgb(143,143,143)] underline hover:text-[var(--settings-fg)] dark:text-zinc-400"
                  >
                    Learn more
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Switch
                  checked={lockdownMode}
                  onCheckedChange={setLockdownMode}
                  className="settings-switch"
                  aria-label="Lockdown mode"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          Section 5: Developer mode
          ===================================================================== */}
      <section className="relative mb-4 mt-2 text-[14px] leading-5">
        <h4 className="mb-1.5 mt-2 text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
          Developer mode
        </h4>

        {/* Row: Developer mode */}
        <div className="flex min-h-[60px] items-center border-b border-black/[0.05] py-2 dark:border-white/[0.06]">
          <div className="w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[var(--settings-fg)]">
                    Developer mode
                  </span>
                  <a
                    href="https://help.openai.com/en/articles/20001062"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border border-[rgb(251,232,219)] bg-[rgb(253,245,241)] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-3 text-[rgb(186,38,35)] transition-colors hover:bg-[rgb(249,231,222)]"
                  >
                    <ShieldAlert className="h-3 w-3 shrink-0" />
                    <span>Elevated risk</span>
                  </a>
                </div>
                <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  Allows you to add unverified connectors that could modify or
                  erase data permanently. Use at your own risk.{" "}
                  <a
                    href="https://platform.openai.com/docs/mcp#risks-and-safety"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clickable-label cursor-pointer text-[rgb(143,143,143)] underline hover:text-[var(--settings-fg)] dark:text-zinc-400"
                  >
                    Learn more
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Switch
                  checked={developerMode}
                  onCheckedChange={(val) => {
                    setDeveloperMode(val);
                    if (!val) setEnforceCsp(false);
                  }}
                  className="settings-switch"
                  aria-label="Developer mode"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row: Enforce CSP in developer mode */}
        <div className="flex min-h-[60px] items-center border-none py-2">
          <div className="w-full">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Enforce CSP in developer mode
                </div>
                <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                  When enabled, dev mode apps without a declared CSP get the same
                  restricted default CSP they would in production instead of
                  unrestricted network access.{" "}
                  <a
                    href="https://developers.openai.com/apps-sdk/build/mcp-server#content-security-policy-csp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="clickable-label cursor-pointer text-[rgb(143,143,143)] underline hover:text-[var(--settings-fg)] dark:text-zinc-400"
                  >
                    Learn more
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <Switch
                  checked={enforceCsp}
                  onCheckedChange={setEnforceCsp}
                  disabled={!developerMode}
                  className="settings-switch"
                  aria-label="Enforce CSP in developer mode"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 6: Secure sign in with Clauxen / ChatGPT & Connected Apps
          ===================================================================== */}
      <section className="relative mb-4 text-[14px] leading-5">
        <div className="flex min-h-[60px] flex-col border-b border-black/[0.1] py-3 dark:border-white/10">
          <div className="w-full">
            <h3 className="text-[18px] font-semibold leading-7 tracking-[-0.01em] text-[var(--settings-fg)] text-balance">
              Secure sign in with Clauxen
            </h3>
            <div className="mt-0.5 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400">
              Sign in to websites and apps across the internet with the trusted
              security of Clauxen.{" "}
              <a
                href="https://help.openai.com/en/collections/13193904-secure-sign-in"
                target="_blank"
                rel="noopener noreferrer"
                className="clickable-label cursor-pointer text-[rgb(143,143,143)] underline hover:text-[var(--settings-fg)] dark:text-zinc-400"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>

        {/* Connected CLI App Item: Codex CLI */}
        <div className="flex min-h-[60px] items-center border-none py-2">
          <div className="w-full">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="mr-4 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Terminal className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                    Codex CLI
                  </div>
                  <div className="text-[12px] leading-4 text-[rgb(93,93,93)] dark:text-zinc-400">
                    Allow Codex CLI to use models from the API.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (codexCliConnected) {
                    if (window.confirm("Disconnect Codex CLI from your account?")) {
                      setCodexCliConnected(false);
                    }
                  } else {
                    setCodexCliConnected(true);
                  }
                }}
                className={
                  codexCliConnected
                    ? "cursor-pointer flex min-h-[28px] shrink-0 items-center justify-center rounded-full border border-[rgb(255,0,42)] px-2.5 text-[12px] font-medium leading-4 text-[rgb(255,0,42)] transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                    : "cursor-pointer flex min-h-[28px] shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white px-2.5 text-[12px] font-medium leading-4 text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                }
              >
                {codexCliConnected ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>
        </div>

        {/* Enable device code authorization */}
        <div className="pb-2">
          <div className="flex min-h-[60px] items-center border-none py-2">
            <div className="w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                    Enable device code authorization for Codex
                  </div>
                  <div className="my-1 pr-6 text-[12px] leading-4 text-[rgb(143,143,143)] dark:text-zinc-400 text-balance">
                    Use device code sign-in for headless or remote environments
                    where the normal browser flow isn’t available. Exercise
                    caution in enabling, as device codes can be phished. Never
                    share a device code.
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Switch
                    checked={deviceCodeAuth}
                    onCheckedChange={setDeviceCodeAuth}
                    className="settings-switch"
                    aria-label="Enable device code authorization for Codex"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dialogs */}
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
    </div>
  );
}
