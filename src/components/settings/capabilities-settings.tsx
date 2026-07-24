"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsPillButton,
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
  "text-[#184f95] underline decoration-[rgba(24,79,149,0.4)] underline-offset-[3px] hover:text-[#1b67b2]";

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
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
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
          className="mb-1 flex w-full items-center justify-between gap-3 rounded-lg bg-[rgba(11,11,11,0.05)] px-3 py-2 text-left transition-colors hover:bg-[rgba(11,11,11,0.07)]"
        >
          <span className="min-w-0 truncate text-[14px] leading-5">
            <span className="text-zinc-900">View and manage memory</span>
            <span className="text-[13px] leading-4 text-zinc-500">
              {" "}
              · {memoryUpdatedLabel}
            </span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-zinc-500"
            strokeWidth={1.75}
            aria-hidden
          />
        </button>

        <div className="flex items-center justify-between gap-7 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-5 text-zinc-900">
              Import memory from other AI providers
            </p>
            <p className="mt-1 text-[14px] leading-5 text-zinc-500">
              Bring relevant context and data from another AI provider to
              Clauxen. We&apos;ll provide a prompt you can use to fetch the
              memory from your other account.{" "}
              <a href="/legal/privacy" className={linkClass}>
                Learn more
              </a>
            </p>
          </div>
          <SettingsPillButton className="h-8 shrink-0 rounded-lg px-3">
            Start import
          </SettingsPillButton>
        </div>
      </SettingsSection>

      <SettingsSection title="General">
        <div className="flex items-center justify-between gap-7 border-b border-[rgba(11,11,11,0.05)] py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-5 text-zinc-900">
              Tool access mode
            </p>
            <p className="mt-1 text-[14px] leading-5 text-zinc-500">
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
          <div className="mt-3 rounded-xl border border-[rgba(11,11,11,0.1)] bg-[rgba(11,11,11,0.05)] p-6">
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
        <p className="py-3 text-[13px] leading-4 text-zinc-600">
          Skills have moved to{" "}
          {onGoToCustomize ? (
            <button
              type="button"
              onClick={() => onGoToCustomize("skills")}
              className={linkClass}
            >
              Customize
            </button>
          ) : (
            <a href="/new#settings/Skills" className={linkClass}>
              Customize
            </a>
          )}
          .
        </p>
      </SettingsSection>
    </div>
  );
}
