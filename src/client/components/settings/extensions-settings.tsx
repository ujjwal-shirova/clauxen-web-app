"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  segmentedOptionClass,
  segmentedTrackClass,
} from "@/lib/segmented-control";
import { SettingsPanelTitle } from "@/components/settings/settings-ui";
import type { ExtensionSubView } from "@/components/settings/constants";
import type { PluginSettings } from "@/lib/api/settings";
import { SkillsSettings } from "@/components/settings/skills-settings";
import {
  ConnectorsCatalogSettings,
  PluginsSettings,
} from "@/components/settings/plugins-settings";

interface ExtensionsSettingsProps {
  initialView?: ExtensionSubView;
  permissionMode: PluginSettings["permissionMode"];
  developerMode: boolean;
  onPluginsChange: (patch: Partial<PluginSettings>) => void;
  onGoToCustomize?: (tab: "skills" | "connectors") => void;
}

const VIEWS: ReadonlyArray<{ id: ExtensionSubView; label: string }> = [
  { id: "skills", label: "Skills" },
  { id: "connectors", label: "Connectors" },
  { id: "plugins", label: "Plugins" },
];

export function ExtensionsSettings({
  initialView = "skills",
  permissionMode,
  developerMode,
  onPluginsChange,
  onGoToCustomize,
}: ExtensionsSettingsProps) {
  const [view, setView] = useState<ExtensionSubView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Extensions</SettingsPanelTitle>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className={cn(segmentedTrackClass)} role="tablist" aria-label="Extensions">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              className={segmentedOptionClass(view === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="settings-muted max-w-[320px] text-[13px] leading-5">
          {view === "skills"
            ? "Reusable instructions Clauxen follows."
            : view === "connectors"
              ? "Services Clauxen can search and use."
              : "Actions Clauxen can run with permission."}
        </p>
      </div>

      {view === "skills" ? <SkillsSettings /> : null}
      {view === "connectors" ? (
        <ConnectorsCatalogSettings
          onAdd={() => {
            setView("plugins");
            onGoToCustomize?.("connectors");
          }}
        />
      ) : null}
      {view === "plugins" ? (
        <PluginsSettings
          permissionMode={permissionMode}
          developerMode={developerMode}
          onChange={onPluginsChange}
        />
      ) : null}
    </div>
  );
}
