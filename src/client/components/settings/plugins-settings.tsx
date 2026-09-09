"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Settings as SettingsCog,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import * as customizeApi from "@/lib/api/customize";
import type { ApiConnector } from "@/lib/api/customize";
import type {
  PluginPermissionMode,
  PluginSettings,
} from "@/lib/api/settings";
import { cn } from "@/lib/utils";
import {
  SettingsButton,
  SettingsChevronRow,
  SettingsEmpty,
  SettingsPanelTitle,
  SettingsSection,
  SettingsTable,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import {
  usePluginInstallations,
  type PluginInstallation,
} from "@/components/plugins/use-plugin-installations";

const FILTERS = ["All", "Connected", "Not connected"] as const;

const DEMO_CONNECTORS = [
  { id: "github", name: "GitHub", type: "Web" },
  { id: "gmail", name: "Gmail", type: "Web" },
  { id: "calendar", name: "Google Calendar", type: "Web" },
  { id: "drive", name: "Google Drive", type: "Web" },
];

interface PluginsOrConnectorsHeaderProps {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
}

function CatalogHeader({
  title,
  onAdd,
  addLabel = "Add",
}: PluginsOrConnectorsHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
          aria-label={`Search ${title.toLowerCase()}`}
        >
          <Search className="h-4 w-4" />
        </button>
        <SettingsButton size="sm" onClick={onAdd}>
          {addLabel}
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </SettingsButton>
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
        onAdd={onAdd}
        addLabel="Add"
      />

      <div className="mb-4 flex w-fit gap-1 rounded-[10px] bg-[var(--settings-icon-bg)]/80 p-0.5">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            aria-pressed={filter === item}
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

      <SettingsTable
        head={
          <tr>
            <th className="px-4 py-2.5 font-medium">Connector</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Status</th>
          </tr>
        }
      >
        {visibleConnectors.length === 0 ? (
          <tr>
            <td
              colSpan={3}
              className="px-4 py-10 text-center text-[var(--settings-fg-muted)]"
            >
              No connectors match this filter.
            </td>
          </tr>
        ) : (
          visibleConnectors.map((row) => (
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
              <td className="px-4 py-3 text-right">
                <SettingsButton
                  size="sm"
                  onClick={() => void toggleConnector(row.id)}
                >
                  {pendingConnector === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : connected.has(row.id) ? (
                    "Connected"
                  ) : (
                    "Connect"
                  )}
                </SettingsButton>
              </td>
            </tr>
          ))
        )}
      </SettingsTable>
    </div>
  );
}

const PERMISSION_OPTIONS: ReadonlyArray<{
  value: PluginPermissionMode;
  label: string;
  description: string;
}> = [
  {
    value: "always-ask",
    label: "Always ask",
    description: "Ask before Clauxen uses any plugin action.",
  },
  {
    value: "allow-low-risk",
    label: "Allow low-risk actions",
    description:
      "Skip confirmation for read-only and other low-risk plugin actions.",
  },
  {
    value: "always-allow",
    label: "Always allow",
    description: "Run plugin actions without asking, including higher-risk ones.",
  },
];

function permissionModeLabel(mode: PluginPermissionMode): string {
  return (
    PERMISSION_OPTIONS.find((option) => option.value === mode)?.label ??
    "Allow low-risk actions"
  );
}

function PluginMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "P").slice(0, 1).toUpperCase();

  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--settings-hairline)] bg-[var(--settings-elevated-bg)] text-[12px] font-semibold text-[var(--settings-fg)]">
      {logoUrl && !failed ? (
        // External plugin artwork — fall back to an initial if the image fails.
        <img
          src={logoUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function SettingsSubpageHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="ui-icon-button no-hover-overlay h-8 w-8 shrink-0 rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <h3 className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.015em] text-[var(--settings-fg)]">
        {title}
      </h3>
    </div>
  );
}

type PluginsView =
  | { kind: "list" }
  | { kind: "permissions" }
  | { kind: "developer" }
  | { kind: "plugin"; plugin: PluginInstallation };

interface PluginsSettingsProps {
  permissionMode: PluginPermissionMode;
  developerMode: boolean;
  onChange: (patch: Partial<PluginSettings>) => void;
}

export function PluginsSettings({
  permissionMode,
  developerMode,
  onChange,
}: PluginsSettingsProps) {
  const installations = usePluginInstallations();
  const [view, setView] = useState<PluginsView>({ kind: "list" });

  const installed = useMemo(
    () =>
      [...installations.connections]
        .filter((connection) => connection.status !== "disconnected")
        .sort((left, right) =>
          (left.connectorName || left.connectorKey).localeCompare(
            right.connectorName || right.connectorKey,
          ),
        ),
    [installations.connections],
  );

  if (view.kind === "permissions") {
    return (
      <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
        <SettingsPanelTitle>Plugin permissions</SettingsPanelTitle>
        <SettingsSubpageHeader
          title="Permissions"
          onBack={() => setView({ kind: "list" })}
        />
        <p className="settings-muted mb-4 max-w-[640px] text-pretty">
          Choose when Clauxen should ask for permission when using plugins.
        </p>
        <SettingsSection>
          {PERMISSION_OPTIONS.map((option, index) => {
            const selected = option.value === permissionMode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ permissionMode: option.value })}
                className={cn(
                  "no-hover-overlay relative flex w-full items-start gap-3 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]",
                  index > 0 &&
                    "before:pointer-events-none before:absolute before:left-[var(--settings-row-pad-x)] before:right-[var(--settings-row-pad-x)] before:top-0 before:h-px before:bg-[var(--settings-hairline)] before:content-['']",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
                    {option.label}
                  </span>
                  <span className="settings-muted mt-0.5 block text-pretty">
                    {option.description}
                  </span>
                </span>
                {selected ? (
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--settings-fg)]"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                ) : (
                  <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
            );
          })}
        </SettingsSection>
      </div>
    );
  }

  if (view.kind === "developer") {
    return (
      <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
        <SettingsPanelTitle>Developer mode</SettingsPanelTitle>
        <SettingsSubpageHeader
          title="Developer mode"
          onBack={() => setView({ kind: "list" })}
        />
        <SettingsSection>
          <SettingsToggleRow
            label="Enable developer mode"
            description="Allow custom plugin endpoints that Clauxen has not verified. Only add plugins you trust."
            checked={developerMode}
            onCheckedChange={(next) => onChange({ developerMode: next })}
            borderless
          />
        </SettingsSection>
      </div>
    );
  }

  if (view.kind === "plugin") {
    const plugin = view.plugin;
    const name = plugin.connectorName || plugin.connectorKey;
    const pluginId = plugin.pluginId || plugin.connectorKey;
    const removing = installations.pendingId === pluginId;
    const statusLabel =
      plugin.status === "active" || plugin.status === "connected"
        ? "Connected"
        : plugin.status === "pending"
          ? "Connecting"
          : plugin.status;

    return (
      <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
        <SettingsPanelTitle>{name}</SettingsPanelTitle>
        <SettingsSubpageHeader
          title={name}
          onBack={() => setView({ kind: "list" })}
        />
        <SettingsSection>
          <div className="flex items-center gap-3 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)]">
            <PluginMark name={name} logoUrl={plugin.logoUrl} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
                {name}
              </p>
              <p className="settings-muted mt-0.5">{statusLabel}</p>
            </div>
          </div>
          {typeof plugin.toolCount === "number" ? (
            <div className="relative flex items-center justify-between px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] before:pointer-events-none before:absolute before:left-[var(--settings-row-pad-x)] before:right-[var(--settings-row-pad-x)] before:top-0 before:h-px before:bg-[var(--settings-hairline)] before:content-['']">
              <span className="text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
                Tools
              </span>
              <span className="settings-muted">{plugin.toolCount}</span>
            </div>
          ) : null}
          <div className="relative flex items-center justify-between px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] before:pointer-events-none before:absolute before:left-[var(--settings-row-pad-x)] before:right-[var(--settings-row-pad-x)] before:top-0 before:h-px before:bg-[var(--settings-hairline)] before:content-['']">
            <span className="text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
              Remove plugin
            </span>
            <SettingsButton
              variant="danger"
              size="sm"
              disabled={removing}
              onClick={() => {
                void installations.remove(pluginId).then((removed) => {
                  if (removed) setView({ kind: "list" });
                });
              }}
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Remove"
              )}
            </SettingsButton>
          </div>
        </SettingsSection>
        {installations.error ? (
          <p className="mt-3 text-[13px] text-[var(--settings-danger)]">
            {installations.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Plugins</SettingsPanelTitle>

      <SettingsSection>
        <SettingsChevronRow
          label="Permissions"
          description="Choose when Clauxen should ask for permission when using plugins."
          value={permissionModeLabel(permissionMode)}
          onClick={() => setView({ kind: "permissions" })}
          borderless
        />
      </SettingsSection>

      <SettingsSection>
        {!installations.loaded ? (
          <p className="settings-muted px-[var(--settings-row-pad-x)] py-4">
            Loading plugins…
          </p>
        ) : installed.length === 0 ? (
          <p className="settings-muted px-[var(--settings-row-pad-x)] py-4">
            You haven’t installed any plugins yet.
          </p>
        ) : (
          installed.map((plugin, index) => {
            const name = plugin.connectorName || plugin.connectorKey;
            return (
              <SettingsChevronRow
                key={plugin.id}
                label={name}
                leading={<PluginMark name={name} logoUrl={plugin.logoUrl} />}
                onClick={() => setView({ kind: "plugin", plugin })}
                borderless={index === 0}
              />
            );
          })
        )}
        <SettingsChevronRow
          label="Developer mode"
          leading={
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--settings-hairline)] bg-[var(--settings-elevated-bg)]">
              <SettingsCog
                className="h-4 w-4 text-[var(--settings-fg)]"
                strokeWidth={1.7}
                aria-hidden
              />
            </span>
          }
          onClick={() => setView({ kind: "developer" })}
        />
      </SettingsSection>
    </div>
  );
}
