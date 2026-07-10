"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";
import { useApiKeys } from "@/frontend/hooks/use-api-keys";

const API_KEY_NAME_MAX = 128;

function sanitizeApiKeyName(name: string): string {
  return name.trim().slice(0, API_KEY_NAME_MAX);
}

type CodeLocalPrefs = {
  classifySessionStates: boolean;
  switchModelsWhenFlagged: boolean;
  createPrsAutomatically: boolean;
  autofixPrs: boolean;
  branchPrefix: string;
  codeFont: string;
  highContrastDark: boolean;
  interfaceFont: string;
  transcriptSize: string;
  transcriptWidth: string;
};

const DEFAULT_CODE_PREFS: CodeLocalPrefs = {
  classifySessionStates: true,
  switchModelsWhenFlagged: true,
  createPrsAutomatically: false,
  autofixPrs: false,
  branchPrefix: "clauxen",
  codeFont: "",
  highContrastDark: false,
  interfaceFont: "Clauxen Sans",
  transcriptSize: "Medium",
  transcriptWidth: "Narrow",
};

export function ClauxenCodeSettings({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
}) {
  const { keys, loading, createKey, revokeKey } = useApiKeys(isAuthenticated);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<CodeLocalPrefs>(DEFAULT_CODE_PREFS);

  useEffect(() => {
    return () => {
      setCreatedKey(null);
    };
  }, []);

  const patchPrefs = (patch: Partial<CodeLocalPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  };

  const handleCreate = async () => {
    if (!isAuthenticated) return;
    const name = window.prompt("Token name");
    const safeName = name ? sanitizeApiKeyName(name) : "";
    if (!safeName) return;
    try {
      const key = await createKey(safeName);
      setCreatedKey(key.key);
    } catch (error) {
      console.error("[settings] create token failed:", error);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!isAuthenticated) return;
    try {
      await revokeKey(keyId);
      setCreatedKey(null);
    } catch (error) {
      console.error("[settings] revoke token failed:", error);
    }
  };

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Clauxen Code</SettingsPanelTitle>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">Clauxen Code</h2>
          <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-zinc-600">
            Clauxen understands your codebase and helps you build, debug, and
            ship faster. Upgrade your plan to get started.
          </p>
          <a
            href="#pricing"
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Upgrade to Max or Pro
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="hidden shrink-0 rounded-xl border border-zinc-200 bg-zinc-900 px-4 py-3 font-mono text-[11px] text-zinc-100 sm:block">
          <p className="text-zinc-400">&gt; Fix the auth bug in signup flow</p>
          <p className="mt-1 text-rose-400">* Contemplating…</p>
        </div>
      </div>

      <SettingsSection title="General">
        <SettingsToggleRow
          label="Classify session states"
          description="Allow Clauxen to automatically classify sessions so you can find and resume work faster."
          checked={prefs.classifySessionStates}
          onCheckedChange={(classifySessionStates) =>
            patchPrefs({ classifySessionStates })
          }
        />
        <SettingsToggleRow
          label="Switch models when a message is flagged"
          description="When safety measures flag a message, automatically switch to a model that can handle it."
          checked={prefs.switchModelsWhenFlagged}
          onCheckedChange={(switchModelsWhenFlagged) =>
            patchPrefs({ switchModelsWhenFlagged })
          }
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Code appearance">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <SettingsOptionPicker
            value="Clauxen Light"
            options={["Clauxen Light", "GitHub Light", "Solarized Light"]}
            onValueChange={() => undefined}
            aria-label="Light code theme"
          />
          <SettingsOptionPicker
            value="Clauxen Dark"
            options={["Clauxen Dark", "GitHub Dark", "Solarized Dark"]}
            onValueChange={() => undefined}
            aria-label="Dark code theme"
          />
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <CodeDiffPreview theme="light" />
          <CodeDiffPreview theme="dark" />
        </div>
        <SettingsRow
          label="Code font"
          description="Set a custom monospace font for code and terminal."
          borderless
        >
          <input
            type="text"
            value={prefs.codeFont}
            onChange={(e) => patchPrefs({ codeFont: e.target.value })}
            placeholder="e.g. JetBrains Mono"
            className="h-9 w-full max-w-[14rem] rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-400"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsToggleRow
          label="High-contrast dark theme"
          description="Use a darker, near-black background when dark mode is on."
          checked={prefs.highContrastDark}
          onCheckedChange={(highContrastDark) =>
            patchPrefs({ highContrastDark })
          }
        />
        <SegmentedRow
          label="Interface font"
          description="Font for the Clauxen Code interface — menus, sidebar, and chat."
          value={prefs.interfaceFont}
          options={["Clauxen Sans", "System"]}
          onChange={(interfaceFont) => patchPrefs({ interfaceFont })}
        />
        <SegmentedRow
          label="Transcript text size"
          description="Size of the conversation transcript text."
          value={prefs.transcriptSize}
          options={["Small", "Medium", "Large"]}
          onChange={(transcriptSize) => patchPrefs({ transcriptSize })}
        />
        <SegmentedRow
          label="Transcript width"
          description="Maximum width of the transcript and composer columns."
          value={prefs.transcriptWidth}
          options={["Narrow", "Medium", "Wide"]}
          onChange={(transcriptWidth) => patchPrefs({ transcriptWidth })}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Pull requests">
        <SettingsRow
          label="Branch prefix"
          description="Prefix added to branch names for both local and cloud sessions."
        >
          <input
            type="text"
            value={prefs.branchPrefix}
            onChange={(e) => patchPrefs({ branchPrefix: e.target.value })}
            className="h-9 w-28 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] outline-none focus:border-zinc-400"
          />
        </SettingsRow>
        <SettingsToggleRow
          label="Create pull requests automatically"
          description="Clauxen will open pull requests without asking when a session finishes."
          checked={prefs.createPrsAutomatically}
          onCheckedChange={(createPrsAutomatically) =>
            patchPrefs({ createPrsAutomatically })
          }
        />
        <SettingsToggleRow
          label="Autofix pull requests"
          description="Monitor CI failures and attempt automatic fixes on open pull requests."
          checked={prefs.autofixPrs}
          onCheckedChange={(autofixPrs) => patchPrefs({ autofixPrs })}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Authorization tokens">
        <p className="mb-3 text-[13px] leading-snug text-zinc-500">
          Created when you sign in to Clauxen Code. Revoke a token to sign out
          from that device.
        </p>

        <div className="mb-3 flex items-center justify-end">
          <SettingsPillButton onClick={() => void handleCreate()}>
            Create token
          </SettingsPillButton>
        </div>

        {createdKey ? (
          <div className="mb-3 rounded-xl border border-green-500/30 bg-green-50 p-4 text-sm">
            <p className="mb-2 font-medium">
              Copy your key now — it won&apos;t be shown again:
            </p>
            <code className="break-all text-xs">{createdKey}</code>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Application</th>
                <th className="px-4 py-2.5 font-medium">Scopes</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    Loading…
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No connected Clauxen Code instances. When you sign in to
                    Clauxen Code, your authorization tokens will appear here.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-medium">{key.name}</td>
                    <td className="px-4 py-3 text-zinc-600">api</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRevoke(key.id)}
                        className="text-[13px] text-rose-600 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <div className="border-t border-zinc-100 pt-6">
        <h3 className="mb-3 text-[15px] font-semibold">
          Clauxen Code (CLI, Desktop, IDE)
        </h3>
        <div className="flex min-h-[72px] items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[14px] font-medium">
              Delete sessions stored by Clauxen
            </p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Removes cloud-stored session history for Clauxen Code. Local
              transcripts on your devices are not affected.{" "}
              <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
                Learn more
              </a>
              .
            </p>
          </div>
          <SettingsPillButton>
            Delete…
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </SettingsPillButton>
        </div>
      </div>
    </div>
  );
}

function SegmentedRow({
  label,
  description,
  value,
  options,
  onChange,
  borderless,
}: {
  label: string;
  description: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  borderless?: boolean;
}) {
  return (
    <div
      className={
        borderless
          ? "flex min-h-[72px] items-start justify-between gap-4 py-3"
          : "flex min-h-[72px] items-start justify-between gap-4 border-b border-zinc-100 py-3"
      }
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-[14px] font-medium">{label}</p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-500">
          {description}
        </p>
      </div>
      <div className="inline-flex shrink-0 rounded-lg bg-zinc-100/90 p-0.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={
                active
                  ? "h-8 rounded-md bg-white px-3 text-[13px] font-medium text-zinc-900 shadow-sm"
                  : "h-8 rounded-md px-3 text-[13px] font-medium text-zinc-500 hover:text-zinc-800"
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodeDiffPreview({ theme }: { theme: "light" | "dark" }) {
  const dark = theme === "dark";
  return (
    <pre
      className={
        dark
          ? "overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-3 font-mono text-[11px] leading-5 text-zinc-200"
          : "overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 font-mono text-[11px] leading-5 text-zinc-800"
      }
    >
      <code>
        <span className="text-zinc-400">1 </span>
        {"function greet(name: string) {\n"}
        <span
          className={
            dark ? "block bg-rose-950/60 text-rose-300" : "block bg-rose-50 text-rose-700"
          }
        >
          <span className="text-zinc-400">2 </span>
          {"-   return \"Hello, \" + name;"}
        </span>
        <span
          className={
            dark
              ? "block bg-emerald-950/60 text-emerald-300"
              : "block bg-emerald-50 text-emerald-700"
          }
        >
          <span className="text-zinc-400">2 </span>
          {"+   return `Hello, ${name}!`;"}
        </span>
        <span className="text-zinc-400">3 </span>
        {"}"}
      </code>
    </pre>
  );
}
