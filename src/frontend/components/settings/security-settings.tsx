"use client";

import { useState } from "react";
import {
  SettingsChevronRow,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";

interface SecuritySettingsProps {
  onLogout?: () => void;
  passkeysCount?: number;
  passkeyAddedLabel?: string;
}

export function SecuritySettings({
  onLogout,
  passkeysCount = 1,
  passkeyAddedLabel = "Last added recently",
}: SecuritySettingsProps) {
  const [authenticatorApp, setAuthenticatorApp] = useState(true);
  const [textMessageMfa, setTextMessageMfa] = useState(false);
  const [deviceCodeAuth, setDeviceCodeAuth] = useState(false);

  return (
    <div className="flex animate-in fade-in flex-col gap-6 duration-300 text-zinc-900">
      <SettingsPanelTitle>Security</SettingsPanelTitle>

      <SettingsChevronRow label="Password" value="••••••" />

      <button
        type="button"
        className="flex w-full min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3 text-left transition-colors hover:bg-zinc-50"
      >
        <div>
          <p className="text-[14px] font-[430] text-zinc-900">Security keys & passkeys</p>
          <p className="mt-1 text-[12px] text-[#8f8f8f]">{passkeyAddedLabel}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[14px] text-[#5d5d5d]">
          {passkeysCount}
          <span aria-hidden>›</span>
        </span>
      </button>

      <section className="pt-2">
        <h3 className="mb-3 text-[18px] font-medium leading-7">
          Multi-factor authentication (MFA)
        </h3>

        <SettingsToggleRow
          label="Authenticator app"
          description="Use one-time codes from an authenticator app."
          checked={authenticatorApp}
          onCheckedChange={setAuthenticatorApp}
        />

        <SettingsToggleRow
          label="Text message"
          description="Get 6-digit verification codes by SMS or WhatsApp based on your country code."
          checked={textMessageMfa}
          onCheckedChange={setTextMessageMfa}
          borderless
        />
      </section>

      <SettingsChevronRow label="Trusted devices" value="1" />

      <section className="border-t border-[#0d0d0d]/5 pt-4">
        <h4 className="mb-3 text-[18px] font-medium leading-7">Advanced security</h4>
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 border-b border-[#0d0d0d]/5 py-3 text-left transition-colors hover:bg-zinc-50"
        >
          <div className="pr-4">
            <p className="text-[14px] font-[430] text-zinc-900">Advanced account security</p>
            <p className="mt-1 text-[12px] leading-4 text-[#8f8f8f] text-pretty">
              Adds the highest level of account security by requiring stronger sign-in
              methods and applying stricter protections to help prevent unauthorized access.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 pt-1 text-[14px] text-[#5d5d5d]">
            Enroll
            <span aria-hidden>›</span>
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-3 border-t border-[#0d0d0d]/10 pt-6">
        <div className="flex min-h-[60px] items-center justify-between gap-4 py-2">
          <span className="text-[14px] font-[430]">Log out of this device</span>
          <SettingsPillButton onClick={onLogout}>Log out</SettingsPillButton>
        </div>

        <div className="flex min-h-[60px] flex-col gap-3 py-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="text-[14px] font-[430]">Log out of all devices</p>
            <p className="mt-1 text-[12px] leading-4 text-[#8f8f8f] text-pretty">
              Log out of all active sessions across all devices, including your current
              session. It may take up to 30 minutes for other devices to be logged out.
            </p>
          </div>
          <SettingsPillButton variant="danger" onClick={onLogout}>
            Log out all
          </SettingsPillButton>
        </div>
      </section>

      <section className="border-t border-[#0d0d0d]/10 pt-6">
        <SettingsSectionHeading>Secure sign in with Clauxen</SettingsSectionHeading>
        <p className="text-[12px] leading-4 text-[#8f8f8f]">
          Sign in to websites and apps across the internet with the trusted security of
          Clauxen.{" "}
          <a href="#" className="underline decoration-[#8f8f8f]/60">
            Learn more
          </a>
        </p>

        <div className="mt-4 flex flex-col gap-3 border-t border-[#0d0d0d]/5 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">
              C
            </div>
            <div>
              <p className="text-[14px] font-[430]">Codex CLI</p>
              <p className="mt-1 text-[12px] text-[#8f8f8f]">
                Allow Codex CLI to use models from the API.
              </p>
            </div>
          </div>
          <SettingsPillButton variant="danger" className="self-start">
            Disconnect
          </SettingsPillButton>
        </div>

        <SettingsToggleRow
          label="Enable device code authorization for Codex"
          description="Use device code sign-in for headless or remote environments where the normal browser flow isn't available. Exercise caution in enabling, as device codes can be phished. Never share a device code."
          checked={deviceCodeAuth}
          onCheckedChange={setDeviceCodeAuth}
          borderless
        />
      </section>
    </div>
  );
}
