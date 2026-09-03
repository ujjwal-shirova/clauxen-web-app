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

const STORAGE_KEY = "clauxen_plugin_collection";
const EVENT_NAME = "clauxen:collection:changed";

function getStoredCollection(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function setStoredCollection(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }));
  } catch {
    // ignore
  }
}

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
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Load collection on client mount & listen for updates
  useEffect(() => {
    setBookmarkedIds(getStoredCollection());

    const handleSync = () => {
      setBookmarkedIds(getStoredCollection());
    };

    window.addEventListener(EVENT_NAME, handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener(EVENT_NAME, handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

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
    const connectorError = params.get("connector_error");
    if (connectorError) {
      setError(
        connectorError === "authorization_denied"
          ? "Plugin sign-in was cancelled."
          : connectorError === "oauth_exchange_failed"
            ? "Plugin sign-in did not complete. Try adding it again."
            : "Plugin sign-in failed. Try adding it again.",
      );
    }
    if (
      params.get("connector_connected") === "1" ||
      params.get("plugin") ||
      params.get("connector")
    ) {
      void refresh();
      const url = new URL(window.location.href);
      url.searchParams.delete("connector_connected");
      url.searchParams.delete("connector_error");
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
        if (payload.data?.status === "authorization_required") {
          throw new Error(
            "This plugin needs sign-in, but no authorization URL was returned.",
          );
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

  const isPending = useCallback(
    (pluginId: string) => byPluginId.get(pluginId)?.status === "pending",
    [byPluginId],
  );

  const isSaved = useCallback(
    (pluginId: string) => bookmarkedIds.includes(pluginId),
    [bookmarkedIds],
  );

  const isInCollection = useCallback(
    (pluginId: string) => isInstalled(pluginId) || isSaved(pluginId),
    [isInstalled, isSaved],
  );

  const toggleCollection = useCallback(
    (pluginId: string): boolean => {
      const current = getStoredCollection();
      const exists = current.includes(pluginId);
      const next = exists
        ? current.filter((id) => id !== pluginId)
        : [...current, pluginId];
      setStoredCollection(next);
      setBookmarkedIds(next);
      return !exists;
    },
    [],
  );

  const addToCollection = useCallback((pluginId: string) => {
    const current = getStoredCollection();
    if (!current.includes(pluginId)) {
      const next = [...current, pluginId];
      setStoredCollection(next);
      setBookmarkedIds(next);
    }
  }, []);

  const removeFromCollection = useCallback((pluginId: string) => {
    const current = getStoredCollection();
    if (current.includes(pluginId)) {
      const next = current.filter((id) => id !== pluginId);
      setStoredCollection(next);
      setBookmarkedIds(next);
    }
  }, []);

  const installedCount = useMemo(
    () => Array.from(byPluginId.values()).filter((c) => c.status === "active").length,
    [byPluginId],
  );

  const collectionCount = useMemo(
    () => new Set([...bookmarkedIds, ...Array.from(byPluginId.keys())]).size,
    [bookmarkedIds, byPluginId],
  );

  return {
    byPluginId,
    pendingId,
    error,
    install,
    remove,
    refresh,
    isInstalled,
    isPending,
    isSaved,
    isInCollection,
    toggleCollection,
    addToCollection,
    removeFromCollection,
    installedCount,
    collectionCount,
    bookmarkedIds,
  };
}
