"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsButton,
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";

export type CapabilitiesSettingsState = {
  generateMemory: boolean;
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
  memoryUpdatedLabel?: string;
}

const TOOL_MODE_LABELS = [
  "Load tools when needed",
  "Auto",
  "Always available",
] as const;

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
  memoryUpdatedLabel = "Updated 3 hours ago",
}: CapabilitiesSettingsProps) {
  return (
    <SettingsPage>
      <SettingsPanelTitle>Capabilities</SettingsPanelTitle>

      <SettingsSection title="Memory" description="What Clauxen retains.">
        <SettingsToggleRow
          label="Remember from chats"
          description="Save relevant context from chats."
          checked={capabilities.generateMemory}
          onCheckedChange={(generateMemory) => onChange({ generateMemory })}
        />

        <button
          type="button"
          className="no-hover-overlay mx-4 mb-2 flex items-center justify-between gap-3 rounded-lg bg-[var(--settings-icon-bg)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)] sm:mx-5"
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
          label="Import memory"
          description="Bring context from another AI provider."
          borderless
        >
          <SettingsButton size="sm">Start import</SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Tools" description="How tools load and switch.">
        <SettingsRow label="Tool access">
          <SettingsOptionPicker
            value={toolModeToLabel(capabilities.toolMode)}
            options={TOOL_MODE_LABELS}
            onValueChange={(label) =>
              onChange({ toolMode: labelToToolMode(label) })
            }
            aria-label="Tool access"
          />
        </SettingsRow>

        <SettingsToggleRow
          label="Switch models when flagged"
          description="Keep chatting on another model instead of pausing."
          checked={capabilities.switchModelsWhenFlagged}
          onCheckedChange={(switchModelsWhenFlagged) =>
            onChange({ switchModelsWhenFlagged })
          }
          borderless
        />
      </SettingsSection>

      <SettingsSection
        title="Creation"
        description="Artifacts, visuals, and code."
      >
        <SettingsToggleRow
          label="Artifacts"
          description="Open code and documents beside the chat."
          checked={capabilities.artifacts}
          onCheckedChange={(artifacts) => onChange({ artifacts })}
          disabled
        />
        <SettingsToggleRow
          label="AI-powered artifacts"
          description="Build apps that use Clauxen inside."
          checked={capabilities.aiPoweredArtifacts}
          onCheckedChange={(aiPoweredArtifacts) =>
            onChange({ aiPoweredArtifacts })
          }
        />
        <SettingsToggleRow
          label="Inline visualizations"
          description="Charts and diagrams inside replies."
          checked={capabilities.inlineVisualizations}
          onCheckedChange={(inlineVisualizations) =>
            onChange({ inlineVisualizations })
          }
        />
        <SettingsToggleRow
          label="Code execution and files"
          description="Run code and create docs, sheets, and PDFs. Required for skills."
          checked={capabilities.codeExecution}
          onCheckedChange={(codeExecution) => {
            onChange({
              codeExecution,
              ...(codeExecution ? {} : { networkEgress: false }),
            });
          }}
          borderless={!capabilities.codeExecution}
        />

        {capabilities.codeExecution ? (
          <div className="border-t border-[var(--settings-hairline)] bg-[var(--settings-sidebar-bg)]">
            <SettingsToggleRow
              label="Allow network access"
              description="Let code install packages for analysis and files."
              checked={capabilities.networkEgress}
              onCheckedChange={(networkEgress) => onChange({ networkEgress })}
              borderless
            />
          </div>
        ) : null}
      </SettingsSection>
    </SettingsPage>
  );
}
