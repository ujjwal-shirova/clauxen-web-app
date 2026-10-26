"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/api/client";

export type ConnectionStatus =
  | "pending"
  | "active"
  | "reauthorization_required"
  | "revoked"
  | "error";

export type PermissionMode = "read_only" | "read_write";
export type ToolRisk = "read" | "write" | "destructive";

/** A plugin the user has connected. Never contains credentials. */
export type PluginConnection = {
  id: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  connectorKind: "mcp" | "rest";
  authType: "mcp_oauth2" | "oauth2" | "none";
  status: ConnectionStatus;
  permissionMode: PermissionMode;
  accountLabel: string | null;
  grantedScopes: string[];
  toolCount: number | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
};

export type PluginAvailability = {
  available: boolean;
  kind: "mcp" | "rest" | null;
  providerLabel: string | null;
  reason: "local_only" | "provider_not_configured" | null;
};

export type ConnectionDetails = {
  connection: PluginConnection;
  tools: Array<{
    name: string;
    title: string;
    description: string;
    risk: ToolRisk;
    enabled: boolean;
  }>;
  resources: Array<{ name: string; title: string; description: string; uri: string | null }>;
  prompts: Array<{ name: string; title: string; description: string }>;
  activity: Array<{
    id: string;
    tool: string;
    risk: ToolRisk;
    status: "ok" | "error" | "blocked";
    detail: string | null;
    durationMs: number | null;
    at: string;
  }>;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await sessionFetch(url, {
    credentials: "same-origin",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message ?? "Something went wrong. Try again.");
  }
  return payload.data;
}

export type ConnectEvent =
  | { type: "connected"; pluginId: string; pluginName: string }
  | { type: "failed"; pluginId: string | null; message: string }
  | { type: "closed"; pluginId: string };

/**
 * Open the provider's sign-in in a popup. The popup goes straight to
 * /api/v1/plugins/connect/:id, which redirects to the provider's own consent
 * page — no blank tab, no Clauxen-hosted authorize screen.
 */
function openConnectWindow(pluginId: string): Window | null {
  const width = 520;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    `/api/v1/plugins/connect/${encodeURIComponent(pluginId)}`,
    `clauxen-connect-${pluginId}`,
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
  );
}

export function usePluginConnections(options: {
  onEvent?: (event: ConnectEvent) => void;
} = {}) {
  const [connections, setConnections] = useState<PluginConnection[]>([]);
  const [availability, setAvailability] = useState<Record<string, PluginAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;
  const pollRef = useRef<number | null>(null);
  const connectingRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getJson<{ connections: PluginConnection[] }>(
        "/api/v1/plugins/connections",
      );
      setConnections(data.connections);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load plugins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    getJson<{ availability: Record<string, PluginAvailability> }>(
      "/api/v1/plugins/availability",
    )
      .then((data) => setAvailability(data.availability))
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        pluginId?: string;
        pluginName?: string;
        message?: string;
      } | null;
      if (data?.type === "clauxen:plugin-connected" && data.pluginId) {
        connectingRef.current = null;
        setConnectingId(null);
        void refresh();
        onEventRef.current?.({
          type: "connected",
          pluginId: data.pluginId,
          pluginName: data.pluginName ?? data.pluginId,
        });
      } else if (data?.type === "clauxen:plugin-connect-failed") {
        connectingRef.current = null;
        setConnectingId(null);
        onEventRef.current?.({
          type: "failed",
          pluginId: data.pluginId ?? null,
          message: data.message ?? "The connection could not be completed.",
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refresh]);

  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const connect = useCallback(
    (pluginId: string) => {
      const popup = openConnectWindow(pluginId);
      if (!popup) {
        // Popup blocked: continue in this tab. This is an API redirect to the
        // provider, not an app page, so a full navigation is required.
        window.location.href = new URL(
          `/api/v1/plugins/connect/${encodeURIComponent(pluginId)}`,
          window.location.origin,
        ).toString();
        return;
      }
      connectingRef.current = pluginId;
      setConnectingId(pluginId);
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        if (!popup.closed) return;
        if (pollRef.current !== null) window.clearInterval(pollRef.current);
        pollRef.current = null;
        if (connectingRef.current === pluginId) {
          connectingRef.current = null;
          setConnectingId(null);
          onEventRef.current?.({ type: "closed", pluginId });
        }
        void refresh();
      }, 600);
    },
    [refresh],
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      await getJson(`/api/v1/plugins/connections/${encodeURIComponent(connectionId)}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh],
  );

  return {
    connections,
    availability,
    loading,
    error,
    connectingId,
    refresh,
    connect,
    disconnect,
  };
}

export function useConnectionDetails(connectionId: string | null) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connectionId) {
      setDetails(null);
      return;
    }
    setLoading(true);
    try {
      setDetails(
        await getJson<ConnectionDetails>(
          `/api/v1/plugins/connections/${encodeURIComponent(connectionId)}`,
        ),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this plugin.");
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: { permissionMode?: PermissionMode; tools?: Record<string, boolean> }) => {
      if (!connectionId) return;
      // Optimistic so switches feel immediate; reload reconciles.
      setDetails((current) =>
        current
          ? {
              ...current,
              connection: patch.permissionMode
                ? { ...current.connection, permissionMode: patch.permissionMode }
                : current.connection,
              tools: patch.tools
                ? current.tools.map((tool) =>
                    tool.name in patch.tools! ? { ...tool, enabled: patch.tools![tool.name] } : tool,
                  )
                : current.tools,
            }
          : current,
      );
      try {
        await getJson(`/api/v1/plugins/connections/${encodeURIComponent(connectionId)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } finally {
        await load();
      }
    },
    [connectionId, load],
  );

  const sync = useCallback(async () => {
    if (!connectionId) return;
    await getJson(`/api/v1/plugins/connections/${encodeURIComponent(connectionId)}/sync`, {
      method: "POST",
    });
    await load();
  }, [connectionId, load]);

  return { details, loading, error, reload: load, update, sync };
}
