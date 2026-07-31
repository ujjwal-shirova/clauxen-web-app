"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import * as customizeApi from "@/lib/api/customize";
import type { ApiConnector } from "@/lib/api/customize";
import { cn } from "@/lib/utils";
import {
  SettingsPanelTitle,
  SettingsPillButton,
} from "@/components/settings/settings-ui";

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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
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
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Connectors</SettingsPanelTitle>
      <CatalogHeader
        title="Connectors"
        showBrowse={false}
        onAdd={onAdd}
        addLabel="Add plugin"
      />

      <div className="mb-4 flex gap-1 rounded-[10px] bg-zinc-100/80 p-0.5 w-fit">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === item
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Connector</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleConnectors.map((row) => (
              <tr key={row.name} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-zinc-600">{row.type}</td>
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
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Plugins</SettingsPanelTitle>
      <CatalogHeader title="Plugins" onBrowse={onBrowse} onAdd={onAdd} />

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Plugin</th>
              <th className="px-4 py-2.5 font-medium">Author</th>
              <th className="px-4 py-2.5 font-medium">Skills</th>
              <th className="px-4 py-2.5 font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_PLUGINS.map((plugin) => (
              <tr key={plugin.name} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {plugin.name}
                </td>
                <td className="px-4 py-3 text-zinc-600">{plugin.author}</td>
                <td className="px-4 py-3 text-zinc-600">{plugin.skills}</td>
                <td className="px-4 py-3 text-zinc-600">{plugin.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
