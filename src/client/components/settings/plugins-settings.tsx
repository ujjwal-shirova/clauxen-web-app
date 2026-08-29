"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ChevronDown, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import * as customizeApi from "@/lib/api/customize";
import type { ApiConnector } from "@/lib/api/customize";
import { cn } from "@/lib/utils";
import {
  SettingsPanelTitle,
  SettingsPillButton,
} from "@/components/settings/settings-ui";

const SkillDirectoryDialog = dynamic(
  () =>
    import("@/components/customize/skills/directory").then(
      (mod) => mod.SkillDirectoryDialog,
    ),
  { ssr: false },
);

const FILTERS = ["All", "Connected", "Not connected"] as const;

const DEMO_CONNECTORS = [
  { id: "github", name: "GitHub", type: "Web" },
  { id: "gmail", name: "Gmail", type: "Web" },
  { id: "calendar", name: "Google Calendar", type: "Web" },
  { id: "drive", name: "Google Drive", type: "Web" },
];

interface PluginsOrConnectorsHeaderProps {
  title: string;
  onBrowse?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  showBrowse?: boolean;
}

function CatalogHeader({
  title,
  onBrowse,
  onAdd,
  addLabel = "Add",
  showBrowse = true,
}: PluginsOrConnectorsHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)]"
          aria-label={`Search ${title.toLowerCase()}`}
        >
          <Search className="h-4 w-4" />
        </button>
        {showBrowse ? (
          <SettingsPillButton onClick={onBrowse}>Browse</SettingsPillButton>
        ) : null}
        <SettingsPillButton onClick={onAdd}>
          {addLabel}
          {addLabel === "Add plugin" ? (
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          )}
        </SettingsPillButton>
      </div>
    </div>
  );
}

interface ConnectorsCatalogSettingsProps {
  onAdd?: () => void;
}

export function ConnectorsCatalogSettings({
  onAdd,
}: ConnectorsCatalogSettingsProps) {
  const auth = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [installed, setInstalled] = useState<ApiConnector[]>([]);
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);
  const connected = new Set(installed.map((item) => item.connectorId));

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    void customizeApi
      .listConnectors()
      .then(({ connectors }) => {
        if (!cancelled) setInstalled(connectors);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated]);

  const visibleConnectors = DEMO_CONNECTORS.filter((connector) => {
    if (filter === "Connected") return connected.has(connector.id);
    if (filter === "Not connected") return !connected.has(connector.id);
    return true;
  });

  const toggleConnector = async (connectorId: string) => {
    if (!auth.isAuthenticated || pendingConnector) return;
    setPendingConnector(connectorId);
    try {
      const result = connected.has(connectorId)
        ? await customizeApi.disconnectConnector(connectorId)
        : await customizeApi.connectConnector(connectorId);
      setInstalled(result.connectors);
    } catch {
      // Keep the last server-confirmed state when an install request fails.
    } finally {
      setPendingConnector(null);
    }
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Connectors</SettingsPanelTitle>
      <CatalogHeader
        title="Connectors"
        showBrowse={false}
        onAdd={onAdd}
        addLabel="Add plugin"
      />

      <div className="mb-4 flex gap-1 rounded-[10px] bg-[var(--settings-icon-bg)]/80 p-0.5 w-fit">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === item
                ? "bg-[var(--settings-elevated-bg)] text-[var(--settings-fg)] shadow-sm"
                : "text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="settings-card overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[var(--settings-sidebar-bg)] text-[var(--settings-fg-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Connector</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleConnectors.map((row) => (
              <tr
                key={row.name}
                className="border-t border-[var(--settings-hairline)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--settings-fg)]">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {row.type}
                </td>
                <td className="px-4 py-3">
                  <SettingsPillButton
                    onClick={() => void toggleConnector(row.id)}
                  >
                    {pendingConnector === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : connected.has(row.id) ? (
                      "Connected"
                    ) : (
                      "Connect"
                    )}
                  </SettingsPillButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DEMO_PLUGINS = [
  {
    name: "Twilio developer kit",
    author: "Twilio",
    skills: 56,
    updated: "7/9/26",
  },
];

interface PluginsSettingsProps {
  onBrowse?: () => void;
  onAdd?: () => void;
}

export function PluginsSettings({ onBrowse, onAdd }: PluginsSettingsProps) {
  const [directoryOpen, setDirectoryOpen] = useState(false);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Plugins</SettingsPanelTitle>
      <CatalogHeader
        title="Plugins"
        onBrowse={() => {
          if (onBrowse) {
            onBrowse();
            return;
          }
          setDirectoryOpen(true);
        }}
        onAdd={onAdd ?? (() => setDirectoryOpen(true))}
      />

      <div className="settings-card overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[var(--settings-sidebar-bg)] text-[var(--settings-fg-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Plugin</th>
              <th className="px-4 py-2.5 font-medium">Author</th>
              <th className="px-4 py-2.5 font-medium">Skills</th>
              <th className="px-4 py-2.5 font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_PLUGINS.map((plugin) => (
              <tr
                key={plugin.name}
                className="border-t border-[var(--settings-hairline)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--settings-fg)]">
                  {plugin.name}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {plugin.author}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {plugin.skills}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {plugin.updated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {directoryOpen ? (
        <SkillDirectoryDialog onClose={() => setDirectoryOpen(false)} />
      ) : null}
    </div>
  );
}
