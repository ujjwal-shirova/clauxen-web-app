"use client";

import { useCallback, useEffect, useState } from "react";

/** A plugin the user has connected to their account. */
export type PluginConnection = {
  id: string;
  pluginId: string;
  pluginName: string;
  pluginIconUrl: string | null;
  mcpUrl: string;
  status: "pending" | "active" | "reauthorization_required" | "revoked" | "error";
  grantedScopes: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
};

export type ConnectionsState = {
  connections: PluginConnection[];
  loading: boolean;
  error: string | null;
};

async function fetchConnections(): Promise<PluginConnection[]> {
  const response = await fetch("/api/v1/plugins/connections", {
    method: "GET",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Sign in to manage your plugins."
        : "Could not load your connected plugins.",
    );
  }
  const payload = (await response.json()) as {
    data?: { connections?: PluginConnection[] };
  };
  return payload.data?.connections ?? [];
}

/**
 * Live list of the plugins the user has connected, plus the actions to start
 * an authorization or revoke one. Refetches when a new-tab authorization
 * reports back via postMessage.
 */
export function usePluginConnections(): ConnectionsState & {
  refresh: () => Promise<void>;
  revoke: (connectionId: string) => Promise<void>;
} {
  const [connections, setConnections] = useState<PluginConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnections(await fetchConnections());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The OAuth callback tab posts this back to its opener once it connects.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === "clauxen:plugin-connected") {
        void refresh();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refresh]);

  const revoke = useCallback(
    async (connectionId: string) => {
      const response = await fetch(
        `/api/v1/plugins/connections/${encodeURIComponent(connectionId)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!response.ok) {
        throw new Error("Could not remove this plugin.");
      }
      await refresh();
    },
    [refresh],
  );

  return { connections, loading, error, refresh, revoke };
}

export type StartAuthResult =
  | { ok: true; authorizeUrl: string }
  | { ok: false; message: string };

/** Ask the server to begin an MCP OAuth authorization for a plugin. */
export async function startPluginAuthorization(
  pluginId: string,
  options?: { returnUrl?: string },
): Promise<StartAuthResult> {
  const response = await fetch("/api/v1/plugins/connections", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      pluginId,
      returnUrl: options?.returnUrl ?? window.location.href,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    data?: { authorizeUrl?: string };
    error?: { message?: string };
  } | null;

  if (!response.ok || !payload?.data?.authorizeUrl) {
    return {
      ok: false,
      message: payload?.error?.message ?? "Could not start plugin authorization.",
    };
  }
  return { ok: true, authorizeUrl: payload.data.authorizeUrl };
}
