"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/lib/segmented-control";
import {
  SettingsButton,
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import { useApiKeys } from "@/hooks/use-api-keys";

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
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
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
    if (!isAuthenticated || creatingToken) return;
    const safeName = sanitizeApiKeyName(tokenName);
    if (!safeName) {
      setTokenError("Name your token first.");
      return;
    }
    setCreatingToken(true);
    setTokenError(null);
    try {
      const key = await createKey(safeName);
      setCreatedKey(key.key);
      setTokenName("");
    } catch (error) {
      setTokenError(
        error instanceof Error ? error.message : "Couldn't create a token.",
      );
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!isAuthenticated) return;
    setTokenError(null);
    try {
      await revokeKey(keyId);
      setCreatedKey(null);
    } catch (error) {
      setTokenError(
        error instanceof Error ? error.message : "Couldn't revoke the token.",
      );
    }
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Clauxen Code</SettingsPanelTitle>

      <div className="settings-card p-5">
        <h2 className="text-[16px] font-semibold">Connect the terminal</h2>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--settings-fg-muted)]">
          Sign in with{" "}
          <code className="rounded bg-[var(--settings-icon-bg)] px-1 py-0.5 text-[12px]">
            clauxen
          </code>{" "}
          (browser OAuth) or create a token below. Sessions bill to your
          Clauxen balance.
        </p>
        <a href="/new#pricing" className="settings-btn settings-btn--primary mt-3 w-fit">
          Upgrade to Max or Pro
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <SettingsSection title="Behavior" description="Sessions and models.">
        <SettingsToggleRow
          label="Classify sessions"
          description="Label sessions so they're easier to resume."
          checked={prefs.classifySessionStates}
          onCheckedChange={(classifySessionStates) =>
            patchPrefs({ classifySessionStates })
          }
        />
        <SettingsToggleRow
          label="Switch models when flagged"
          description="Move to a model that can handle the message."
          checked={prefs.switchModelsWhenFlagged}
          onCheckedChange={(switchModelsWhenFlagged) =>
            patchPrefs({ switchModelsWhenFlagged })
          }
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Appearance" description="Themes and type.">
        <div className="grid gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-5">
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
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <CodeDiffPreview theme="light" />
          <CodeDiffPreview theme="dark" />
        </div>
        <SettingsToggleRow
          label="High-contrast dark"
          description="Near-black background in dark mode."
          checked={prefs.highContrastDark}
          onCheckedChange={(highContrastDark) =>
            patchPrefs({ highContrastDark })
          }
        />
        <SegmentedRow
          label="Interface font"
          value={prefs.interfaceFont}
          options={["Clauxen Sans", "System"]}
          onChange={(interfaceFont) => patchPrefs({ interfaceFont })}
        />
        <SegmentedRow
          label="Transcript size"
          value={prefs.transcriptSize}
          options={["Small", "Medium", "Large"]}
          onChange={(transcriptSize) => patchPrefs({ transcriptSize })}
        />
        <SegmentedRow
          label="Transcript width"
          value={prefs.transcriptWidth}
          options={["Narrow", "Medium", "Wide"]}
          onChange={(transcriptWidth) => patchPrefs({ transcriptWidth })}
        />
        <SettingsRow label="Code font" description="Custom monospace." borderless>
          <input
            type="text"
            value={prefs.codeFont}
            onChange={(e) => patchPrefs({ codeFont: e.target.value })}
            placeholder="e.g. JetBrains Mono"
            className="settings-field max-w-[14rem]"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Pull requests" description="Branches and automation.">
        <SettingsRow label="Branch prefix">
          <input
            type="text"
            value={prefs.branchPrefix}
            onChange={(e) => patchPrefs({ branchPrefix: e.target.value })}
            className="settings-field w-28"
          />
        </SettingsRow>
        <SettingsToggleRow
          label="Open pull requests automatically"
          description="Open one when a session finishes."
          checked={prefs.createPrsAutomatically}
          onCheckedChange={(createPrsAutomatically) =>
            patchPrefs({ createPrsAutomatically })
          }
        />
        <SettingsToggleRow
          label="Autofix pull requests"
          description="Attempt fixes when CI fails."
          checked={prefs.autofixPrs}
          onCheckedChange={(autofixPrs) => patchPrefs({ autofixPrs })}
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Tokens"
        description="Created at sign-in. Revoking signs out that device."
      >
        <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:px-5">
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name, e.g. MacBook"
            maxLength={API_KEY_NAME_MAX}
            className="settings-field flex-1"
            aria-label="Token name"
          />
          <SettingsButton
            onClick={() => void handleCreate()}
            disabled={creatingToken || !isAuthenticated}
          >
            {creatingToken ? "Creating…" : "Create token"}
          </SettingsButton>
        </div>

        {createdKey ? (
          <div className="mx-4 mb-3 rounded-xl border border-[hsl(var(--success))] bg-[var(--success-soft)] p-4 text-sm sm:mx-5">
            <p className="mb-2 font-medium">
              Copy your key now — it won&apos;t be shown again:
            </p>
            <code className="break-all text-xs">{createdKey}</code>
          </div>
        ) : null}

        {tokenError ? (
          <p className="px-4 pb-3 text-[13px] text-[var(--settings-danger)] sm:px-5">
            {tokenError}
          </p>
        ) : null}

        <div className="border-t border-[var(--settings-hairline)]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--settings-sidebar-bg)] text-[var(--settings-fg-muted)]">
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
                    className="px-4 py-8 text-center text-[var(--settings-fg-muted)]"
                  >
                    Loading…
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-[var(--settings-fg-muted)]"
                  >
                    No tokens yet. Sign in to Clauxen Code or create one above.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr
                    key={key.id}
                    className="border-t border-[var(--settings-hairline)]"
                  >
                    <td className="px-4 py-3 font-medium">{key.name}</td>
                    <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                      api
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRevoke(key.id)}
                        className="cursor-pointer text-[13px] font-medium text-[var(--settings-danger)] hover:underline"
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

      <SettingsSection title="Sessions" description="Cloud-stored history.">
        <SettingsRow
          label="Delete stored sessions"
          description="Local transcripts on your devices stay."
          borderless
        >
          <SettingsButton variant="danger">
            Delete…
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}

function SegmentedRow({
  label,
  value,
  options,
  onChange,
  borderless,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  borderless?: boolean;
}) {
  return (
    <SettingsRow label={label} borderless={borderless}>
      <div className={segmentedTrackClass} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={segmentedOptionClass(active)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </SettingsRow>
  );
}

function CodeDiffPreview({ theme }: { theme: "light" | "dark" }) {
  const dark = theme === "dark";
  return (
    <pre
      className={
        dark
          ? "overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-3 font-mono text-[11px] leading-5 text-zinc-200"
          : "overflow-hidden rounded-xl border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] p-3 font-mono text-[11px] leading-5 text-[var(--settings-fg)]"
      }
    >
      <code>
        <span className="text-[var(--settings-fg-subtle)]">1 </span>
        {"function greet(name: string) {\n"}
        <span
          className={
            dark
              ? "block bg-rose-950/60 text-rose-300"
              : "block bg-rose-50 text-rose-700"
          }
        >
          <span className="text-[var(--settings-fg-subtle)]">2 </span>
          {'-   return "Hello, " + name;'}
        </span>
        <span
          className={
            dark
              ? "block bg-emerald-950/60 text-emerald-300"
              : "block bg-emerald-50 text-emerald-700"
          }
        >
          <span className="text-[var(--settings-fg-subtle)]">2 </span>
          {"+   return `Hello, ${name}!`;"}
        </span>
        <span className="text-[var(--settings-fg-subtle)]">3 </span>
        {"}"}
      </code>
    </pre>
  );
}
