"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PluginInstallation = {
  id: string;
  connectorKey: string;
  connectorName: string;
  pluginId?: string | null;
  status: string;
  toolCount?: number;
};

type InstallEnvelope = {
  data?: {
    status?: string;
    authorizeUrl?: string | null;
    installationId?: string | null;
  };
  error?: { message?: string };
};

type ConnectionsEnvelope = {
  data?: { connections?: PluginInstallation[] };
};

function pluginReturnPath(pluginId: string, category?: string | null) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const query = params.toString();
  return `/plugins/${encodeURIComponent(pluginId)}${query ? `?${query}` : ""}`;
}

export function usePluginInstallations() {
  const [connections, setConnections] = useState<PluginInstallation[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/v1/connectors", { cache: "no-store" });
    if (response.status === 401) return;
    if (!response.ok) return;
    const payload = (await response.json()) as ConnectionsEnvelope;
    setConnections(payload.data?.connections ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("connector_connected") === "1" ||
      params.get("plugin") ||
      params.get("connector")
    ) {
      void refresh();
      const url = new URL(window.location.href);
      url.searchParams.delete("connector_connected");
      url.searchParams.delete("plugin");
      url.searchParams.delete("connector");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [refresh]);

  const byPluginId = useMemo(() => {
    const map = new Map<string, PluginInstallation>();
    for (const connection of connections) {
      if (connection.pluginId) map.set(connection.pluginId, connection);
    }
    return map;
  }, [connections]);

  const install = useCallback(
    async (
      pluginId: string,
      options?: { category?: string | null; returnPath?: string },
    ) => {
      setPendingId(pluginId);
      setError(null);
      const returnPath =
        options?.returnPath && options.returnPath.startsWith("/plugins")
          ? options.returnPath
          : pluginReturnPath(pluginId, options?.category);
      try {
        const response = await fetch("/api/v1/plugins/install", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pluginId, returnPath }),
        });
        const payload = (await response.json()) as InstallEnvelope;
        if (response.status === 401) {
          window.location.assign(
            `/login?redirectTo=${encodeURIComponent(returnPath)}`,
          );
          return;
        }
        if (!response.ok) {
          throw new Error(
            payload.error?.message || "Unable to add this plugin.",
          );
        }
        if (payload.data?.authorizeUrl) {
          window.location.assign(payload.data.authorizeUrl);
          return;
        }
        await refresh();
      } catch (installError) {
        setError(
          installError instanceof Error
            ? installError.message
            : "Unable to add this plugin.",
        );
      } finally {
        setPendingId(null);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (pluginId: string) => {
      const connection = byPluginId.get(pluginId);
      if (!connection) return;
      setPendingId(pluginId);
      setError(null);
      try {
        const response = await fetch(
          `/api/v1/connectors/installations/${encodeURIComponent(connection.id)}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          throw new Error("Unable to remove this plugin.");
        }
        await refresh();
      } catch (removeError) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Unable to remove this plugin.",
        );
      } finally {
        setPendingId(null);
      }
    },
    [byPluginId, refresh],
  );

  const isInstalled = useCallback(
    (pluginId: string) => byPluginId.get(pluginId)?.status === "active",
    [byPluginId],
  );

  return {
    byPluginId,
    pendingId,
    error,
    install,
    remove,
    refresh,
    isInstalled,
  };
}
