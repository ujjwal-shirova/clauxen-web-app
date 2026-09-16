"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  LoaderCircle,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError, apiFetch } from "@/lib/api/client";

const CURSOR_AGENTS_URL = "https://cursor.com/agents";

type ProviderId = "vercel" | "supabase" | "cloudflare";

type Provider = {
  id: ProviderId;
  name: string;
  blurb: string;
  permissionUrl: string;
  permissionLabel: string;
  scopesHint: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "vercel",
    name: "Vercel",
    blurb:
      "Deployments, projects, and env sync for autonomous builds. The Vercel MCP itself authorizes via OAuth in Cursor.",
    permissionUrl: "https://vercel.com/account/tokens",
    permissionLabel: "Open Vercel token permissions",
    scopesHint: "Create a token with Full access, then save it as VERCEL_TOKEN.",
  },
  {
    id: "supabase",
    name: "Supabase",
    blurb:
      "Database, migrations, edge functions, branches, and storage through the Supabase MCP and CLI.",
    permissionUrl: "https://supabase.com/dashboard/account/tokens",
    permissionLabel: "Open Supabase token permissions",
    scopesHint:
      "Create a personal access token with full scopes, then save it as SUPABASE_ACCESS_TOKEN.",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    blurb:
      "Workers, R2, KV, D1, builds, and observability through the Cloudflare MCP servers and wrangler.",
    permissionUrl: "https://dash.cloudflare.com/profile/api-tokens",
    permissionLabel: "Open Cloudflare token permissions",
    scopesHint:
      "Create a token with Workers / R2 / KV / D1 / Hyperdrive Edit plus Observability Read, then save it as CLOUDFLARE_API_TOKEN.",
  },
];

type StatusResponse = {
  vercel: { tokenConfigured: boolean };
  supabase: { tokenConfigured: boolean };
  cloudflare: { tokenConfigured: boolean; accountIdConfigured: boolean };
};

type PlatformConnector = {
  key: string;
  name: string;
  toolCount: number;
  oauthConfigured: boolean;
  connected: boolean;
  installationId: string | null;
};

type GatewayHealth = {
  mode: "gateway" | "local";
  gatewayConfigured: boolean;
  gatewayReachable: boolean;
};

function openPermissionTab(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return win !== null;
}

function StatusBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ready
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {ready ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <CircleDashed className="size-3.5" />
      )}
      {label}
    </span>
  );
}

export function IntegrationsConnectView() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [apps, setApps] = useState<PlatformConnector[]>([]);
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const autoAttempted = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [tokenStatus, catalog, gateway] = await Promise.all([
        apiFetch<StatusResponse>("/api/v1/integrations/status"),
        apiFetch<{ connectors: PlatformConnector[] }>(
          "/api/v1/connectors/catalog",
        ).catch(() => ({ connectors: [] as PlatformConnector[] })),
        apiFetch<GatewayHealth>("/api/v1/connectors/health").catch(() => null),
      ]);
      setStatus(tokenStatus);
      setApps(catalog.connectors);
      setHealth(gateway);
      setAuthRequired(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthRequired(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectorError = params.get("connector_error");
    if (connectorError) {
      setAppError(
        connectorError === "connector_not_configured"
          ? "This app is not configured with an OAuth client yet."
          : "Sign-in did not complete. Try connecting again.",
      );
    }
    if (
      params.get("connector_connected") === "1" ||
      params.get("connector") ||
      connectorError
    ) {
      void refresh();
      const url = new URL(window.location.href);
      url.searchParams.delete("connector_connected");
      url.searchParams.delete("connector_error");
      url.searchParams.delete("connector");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [refresh]);

  const connectApp = useCallback(async (app: PlatformConnector) => {
    setConnectingKey(app.key);
    setAppError(null);
    try {
      const result = await apiFetch<{ authorizeUrl: string }>(
        `/api/v1/connectors/${encodeURIComponent(app.key)}/oauth/start`,
        {
          method: "POST",
          body: JSON.stringify({ returnPath: "/connectors" }),
        },
      );
      window.location.assign(result.authorizeUrl);
    } catch (error) {
      setAppError(
        error instanceof ApiError
          ? error.message
          : "Unable to start this connection.",
      );
      setConnectingKey(null);
    }
  }, []);

  const disconnectApp = useCallback(
    async (app: PlatformConnector) => {
      if (!app.installationId) return;
      setConnectingKey(app.key);
      setAppError(null);
      try {
        await apiFetch(
          `/api/v1/connectors/installations/${encodeURIComponent(app.installationId)}`,
          { method: "DELETE" },
        );
        await refresh();
      } catch (error) {
        setAppError(
          error instanceof ApiError
            ? error.message
            : "Unable to disconnect this app.",
        );
      } finally {
        setConnectingKey(null);
      }
    },
    [refresh],
  );

  const openAll = useCallback(() => {
    setBlocked(false);
    const urls = [
      CURSOR_AGENTS_URL,
      ...PROVIDERS.map((provider) => provider.permissionUrl),
    ];
    const results = urls.map((url) => openPermissionTab(url));
    if (results.some((ok) => !ok)) {
      setBlocked(true);
    } else {
      setOpened(urls);
    }
  }, []);

  useEffect(() => {
    if (autoAttempted.current) return;
    autoAttempted.current = true;
    if (window.location.search.includes("auto=1")) {
      openAll();
    }
  }, [openAll]);

  const openOne = useCallback((url: string) => {
    if (!openPermissionTab(url)) {
      setBlocked(true);
    } else {
      setOpened((prev) => (prev.includes(url) ? prev : [...prev, url]));
    }
  }, []);

  const tokenReady = useCallback(
    (id: ProviderId) => {
      if (!status) return false;
      return status[id].tokenConfigured;
    },
    [status],
  );

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <p className="settings-section-label mb-2">Integrations</p>
      <h1 className="app-page-title mb-3">
        Connect apps, Vercel, Supabase &amp; Cloudflare
      </h1>
      <p className="settings-muted mb-6 max-w-[62ch] leading-6">
        Clauxen apps authenticate through Cloudflare. Access tokens are sealed
        in Supabase before they are stored. The full catalog lives on{" "}
        <a className="underline" href="/connectors">
          /connectors
        </a>
        . Builder tokens for Cursor stay on this page.
      </p>

      <div className="settings-card mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 bg-[var(--settings-canvas-bg)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="settings-section-label">Clauxen apps</p>
            {health ? (
              <StatusBadge
                ready={health.gatewayConfigured && health.gatewayReachable}
                label={
                  health.gatewayConfigured && health.gatewayReachable
                    ? "Cloudflare gateway live"
                    : health.gatewayConfigured
                      ? "Gateway unreachable"
                      : "Local-only mode"
                }
              />
            ) : null}
          </div>
          <p className="settings-muted leading-6">
            GitHub, Slack, Notion, Gmail, Drive, and Figma use the connector
            gateway. Connect once, then the model can call their tools.
          </p>
          {appError ? (
            <p className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-300">
              {appError}
            </p>
          ) : null}
          <div className="grid gap-3">
            {apps.map((app) => {
              const busy = connectingKey === app.key;
              return (
                <div
                  key={app.key}
                  className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--settings-hairline)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-[var(--settings-fg)]">
                        {app.name}
                      </p>
                      <StatusBadge
                        ready={app.connected}
                        label={
                          app.connected
                            ? "Connected"
                            : app.oauthConfigured
                              ? "Ready to connect"
                              : "Needs OAuth app"
                        }
                      />
                    </div>
                    <p className="settings-muted mt-1 text-[13px] leading-5">
                      {app.toolCount} tools for the model after you connect.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {app.connected && app.installationId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void disconnectApp(app)}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" />
                        ) : null}
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => void connectApp(app)}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" />
                        ) : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="settings-card mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 bg-[var(--settings-canvas-bg)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="settings-section-label mb-1.5">
              One-click permission tabs
            </p>
            <p className="settings-muted leading-6">
              Opens the Cursor MCP dashboard plus all three provider permission
              pages in new tabs.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="shrink-0"
            onClick={openAll}
          >
            <PlugZap />
            Open all permission tabs
          </Button>
        </div>
      </div>

      {blocked ? (
        <p className="mb-4 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-700 dark:text-amber-300">
          Your browser blocked the automatic tabs. Allow popups for this site
          and click the button again, or open each provider below one by one.
        </p>
      ) : null}

      {opened.length > 0 && !blocked ? (
        <p className="settings-muted mb-4 text-sm leading-6">
          Opened {opened.length} tab{opened.length === 1 ? "" : "s"} in your
          browser. Complete each permission screen there, then refresh the
          status.
        </p>
      ) : null}

      <div className="grid w-full grid-cols-1 gap-3 sm:gap-4">
        <div className="settings-card overflow-hidden">
          <div className="flex flex-col gap-4 bg-[var(--settings-canvas-bg)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="settings-section-label">Cursor MCP dashboard</p>
              <StatusBadge
                ready={opened.includes(CURSOR_AGENTS_URL)}
                label={
                  opened.includes(CURSOR_AGENTS_URL)
                    ? "Tab opened"
                    : "Action needed"
                }
              />
            </div>
            <p className="settings-muted leading-6">
              Enable the custom MCP servers and press Connect for{" "}
              <code className="text-[13px]">vercel</code>,{" "}
              <code className="text-[13px]">supabase</code>,{" "}
              <code className="text-[13px]">cloudflare-api</code>,{" "}
              <code className="text-[13px]">cloudflare-bindings</code>,{" "}
              <code className="text-[13px]">cloudflare-builds</code>, and{" "}
              <code className="text-[13px]">cloudflare-observability</code>.
            </p>
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openOne(CURSOR_AGENTS_URL)}
              >
                <ExternalLink />
                Open cursor.com/agents
              </Button>
            </div>
          </div>
        </div>

        {PROVIDERS.map((provider) => {
          const ready = tokenReady(provider.id);
          return (
            <div key={provider.id} className="settings-card overflow-hidden">
              <div className="flex flex-col gap-4 bg-[var(--settings-canvas-bg)] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="settings-section-label">{provider.name}</p>
                  {loading ? (
                    <StatusBadge ready={false} label="Checking…" />
                  ) : (
                    <StatusBadge
                      ready={ready}
                      label={ready ? "Token detected" : "Needs token"}
                    />
                  )}
                </div>
                <p className="settings-muted leading-6">{provider.blurb}</p>
                <p className="text-[13px] leading-6 text-[var(--settings-fg)]">
                  {provider.scopesHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={ready ? "secondary" : "default"}
                    onClick={() => openOne(provider.permissionUrl)}
                  >
                    <ExternalLink />
                    {provider.permissionLabel}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="settings-card mt-4 overflow-hidden">
        <div className="bg-[var(--settings-canvas-bg)] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="settings-section-label mb-1.5">
                After granting permissions
              </p>
              <p className="settings-muted leading-6">
                Save each token in Cursor Dashboard → Cloud Agents → Secrets as{" "}
                <code className="text-[13px]">VERCEL_TOKEN</code>,{" "}
                <code className="text-[13px]">SUPABASE_ACCESS_TOKEN</code>, and{" "}
                <code className="text-[13px]">CLOUDFLARE_API_TOKEN</code> (+{" "}
                <code className="text-[13px]">CLOUDFLARE_ACCOUNT_ID</code>),
                then refresh.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
              Refresh status
            </Button>
          </div>
          {authRequired ? (
            <p className="mt-3 text-sm leading-6 text-[var(--settings-fg)]">
              Sign in is required to check server token status.{" "}
              <a className="underline" href="/login">
                Go to login
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
