"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";

export type CapabilitiesSettingsState = {
  generateMemory: boolean;
  connectorSearch: boolean;
  switchModelsWhenFlagged: boolean;
  artifacts: boolean;
  aiPoweredArtifacts: boolean;
  inlineVisualizations: boolean;
  codeExecution: boolean;
  networkEgress: boolean;
  toolMode: string;
};

interface CapabilitiesSettingsProps {
  capabilities: CapabilitiesSettingsState;
  onChange: (patch: Partial<CapabilitiesSettingsState>) => void;
  onGoToCustomize?: (tab: "skills" | "connectors") => void;
  memoryUpdatedLabel?: string;
}

const TOOL_MODE_LABELS = [
  "Load tools when needed",
  "Auto",
  "Always available",
] as const;

const linkClass =
  "clickable-label cursor-pointer font-medium text-[var(--settings-fg)] underline decoration-[var(--settings-input-border)] underline-offset-[3px] hover:decoration-[var(--settings-fg)]";

function toolModeToLabel(mode: string): string {
  if (mode === "auto") return "Auto";
  if (mode === "always") return "Always available";
  return "Load tools when needed";
}

function labelToToolMode(label: string): string {
  if (label === "Auto") return "auto";
  if (label === "Always available") return "always";
  return "on-demand";
}

export function CapabilitiesSettings({
  capabilities,
  onChange,
  onGoToCustomize,
  memoryUpdatedLabel = "Updated 3 hours ago",
}: CapabilitiesSettingsProps) {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Capabilities</SettingsPanelTitle>

      <SettingsSection title="Memory">
        <SettingsToggleRow
          label="Generate memory from chat history"
          description={
            <>
              Allow Clauxen to remember relevant context from your chats. This
              setting controls memory for both chats and projects.{" "}
              <a href="/legal/privacy" className={linkClass}>
                Learn more
              </a>
              .
            </>
          }
          checked={capabilities.generateMemory}
          onCheckedChange={(generateMemory) => onChange({ generateMemory })}
        />

        <button
          type="button"
          className="no-hover-overlay mx-[var(--settings-row-pad-x)] mb-2 flex items-center justify-between gap-3 rounded-lg bg-[var(--settings-icon-bg)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]"
        >
          <span className="min-w-0 truncate text-[14px] leading-5">
            <span className="text-[var(--settings-fg)]">
              View and manage memory
            </span>
            <span className="text-[13px] leading-4 text-[var(--settings-fg-muted)]">
              {" "}
              · {memoryUpdatedLabel}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-[var(--settings-fg-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
        </button>

        <SettingsRow
          label="Import memory from other AI providers"
          description={
            <>
              Bring relevant context and data from another AI provider to
              Clauxen. We&apos;ll provide a prompt you can use to fetch the
              memory from your other account.{" "}
              <a href="/legal/privacy" className={linkClass}>
                Learn more
              </a>
            </>
          }
          borderless
        >
          <SettingsPillButton className="h-8 shrink-0 rounded-lg px-3">
            Start import
          </SettingsPillButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="General">
        <SettingsRow
          label="Tool access mode"
          description="Controls how connector tools are loaded in new conversations."
        >
          <SettingsOptionPicker
            value={toolModeToLabel(capabilities.toolMode)}
            options={TOOL_MODE_LABELS}
            onValueChange={(label) =>
              onChange({ toolMode: labelToToolMode(label) })
            }
          />
        </SettingsRow>

        <SettingsToggleRow
          label="Connector search"
          description="Let Clauxen search the connector directory and surface ones relevant to your conversation."
          checked={capabilities.connectorSearch}
          onCheckedChange={(connectorSearch) => onChange({ connectorSearch })}
        />

        <SettingsToggleRow
          label="Switch models when a message is flagged"
          description="When safety measures flag a message, automatically switch to a different model to keep chatting. When off, your chat will pause instead."
          checked={capabilities.switchModelsWhenFlagged}
          onCheckedChange={(switchModelsWhenFlagged) =>
            onChange({ switchModelsWhenFlagged })
          }
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Visuals">
        <SettingsToggleRow
          label="Artifacts"
          description="Generate code, documents, and designs in a dedicated window alongside your conversation."
          checked={capabilities.artifacts}
          onCheckedChange={(artifacts) => onChange({ artifacts })}
          disabled
        />
        <SettingsToggleRow
          label="AI-powered artifacts"
          description="Build apps and interactive documents that use Clauxen inside the artifact."
          checked={capabilities.aiPoweredArtifacts}
          onCheckedChange={(aiPoweredArtifacts) =>
            onChange({ aiPoweredArtifacts })
          }
        />
        <SettingsToggleRow
          label="Inline visualizations"
          description="Allow Clauxen to generate interactive visualizations, charts, and diagrams directly in the conversation."
          checked={capabilities.inlineVisualizations}
          onCheckedChange={(inlineVisualizations) =>
            onChange({ inlineVisualizations })
          }
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Code execution and file creation">
        <SettingsToggleRow
          label="Code execution and file creation"
          description="Clauxen can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports. Required for skills."
          checked={capabilities.codeExecution}
          onCheckedChange={(codeExecution) => {
            onChange({
              codeExecution,
              ...(codeExecution ? {} : { networkEgress: false }),
            });
          }}
        />

        {capabilities.codeExecution ? (
          <div className="border-t border-[var(--settings-hairline)] bg-[var(--settings-sidebar-bg)]">
            <SettingsToggleRow
              label="Allow network egress"
              description={
                <>
                  Allow Clauxen to access common package managers to install
                  packages and libraries for data analysis, visualizations, and
                  file processing.{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    View package manager domains
                  </a>
                  . Monitor chats closely as this comes with{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    security risks
                  </a>
                  .
                </>
              }
              checked={capabilities.networkEgress}
              onCheckedChange={(networkEgress) => onChange({ networkEgress })}
              borderless
            />
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Skills">
        <p className="py-3 text-[13px] leading-4 text-[var(--settings-fg-muted)]">
          Skills live in the{" "}
          {onGoToCustomize ? (
            <button
              type="button"
              onClick={() => onGoToCustomize("skills")}
              className={linkClass}
            >
              Skills
            </button>
          ) : (
            <a href="/new#settings/Skills" className={linkClass}>
              Skills
            </a>
          )}{" "}
          settings tab.
        </p>
      </SettingsSection>
    </div>
  );
}
