"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSection,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";

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
  onGoToCustomize,
}: CapabilitiesSettingsProps) {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Capabilities</SettingsPanelTitle>

      <SettingsSection title="Memory">
        <SettingsToggleRow
          label="Generate memory from chat history"
          description={
            <>
              Allow Clauxen to remember relevant context from your chats.{" "}
              <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
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
          className="flex min-h-[56px] w-full items-center justify-between gap-4 border-b border-zinc-100 py-3 text-left transition-colors hover:bg-zinc-50"
        >
          <div>
            <p className="text-[14px] font-medium">View and manage memory</p>
            <p className="mt-0.5 text-[13px] text-zinc-500">Updated recently</p>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
        </button>

        <div className="flex min-h-[72px] items-start justify-between gap-4 border-b border-zinc-100 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">
              Import memory from other AI providers
            </p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Bring relevant context from another AI provider into Clauxen.{" "}
              <a href="/legal/privacy" className="text-[#1b67b2] hover:underline">
                Learn more
              </a>
              .
            </p>
          </div>
          <SettingsPillButton className="shrink-0">
            Start import
          </SettingsPillButton>
        </div>
      </SettingsSection>

      <SettingsSection title="General">
        <div className="flex min-h-[72px] items-start justify-between gap-4 border-b border-zinc-100 py-3">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[14px] font-medium">Tool access mode</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Controls how connector tools are loaded in new conversations.
            </p>
          </div>
          <SettingsOptionPicker
            value={toolModeToLabel(capabilities.toolMode)}
            options={TOOL_MODE_LABELS}
            onValueChange={(label) =>
              onChange({ toolMode: labelToToolMode(label) })
            }
          />
        </div>

        <SettingsToggleRow
          label="Connector search"
          description="Allow Clauxen to search across connected apps when answering."
          checked={capabilities.connectorSearch}
          onCheckedChange={(connectorSearch) => onChange({ connectorSearch })}
        />
        <SettingsToggleRow
          label="Switch models when a message is flagged"
          description="When safety measures flag a message, automatically switch to a model that can handle it."
          checked={capabilities.switchModelsWhenFlagged}
          onCheckedChange={(switchModelsWhenFlagged) =>
            onChange({ switchModelsWhenFlagged })
          }
        />
      </SettingsSection>

      <SettingsSection title="Visuals">
        <SettingsToggleRow
          label="Artifacts"
          description="Generate code, documents, and designs in a dedicated window alongside your conversation."
          checked={capabilities.artifacts}
          onCheckedChange={(artifacts) => onChange({ artifacts })}
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
        />
      </SettingsSection>

      <SettingsSection title="Code execution and file creation">
        <SettingsToggleRow
          label="Code execution and file creation"
          description="Clauxen can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports. Required for skills."
          checked={capabilities.codeExecution}
          onCheckedChange={(codeExecution) => onChange({ codeExecution })}
        />

        {capabilities.codeExecution ? (
          <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
            <SettingsToggleRow
              label="Allow network egress"
              description={
                <>
                  Allow Clauxen to access common package managers to install
                  packages and libraries.{" "}
                  <a href="#" className="text-[#1b67b2] hover:underline">
                    View package manager domains
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-[#1b67b2] hover:underline">
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

      {onGoToCustomize ? (
        <p className="mt-6 text-[13px] text-zinc-500">
          Skills have moved to{" "}
          <button
            type="button"
            onClick={() => onGoToCustomize("skills")}
            className="text-[#1b67b2] hover:underline"
          >
            Customize
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}
