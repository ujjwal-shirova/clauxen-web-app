"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, apiFetch } from "@/lib/api/client";
import type {
  ConnectorApproval,
  ConnectorAvailability,
  ConnectorConnection,
} from "@/lib/plugin-connectors";

type ConnectorOverview = {
  availability: ConnectorAvailability[];
  connections: ConnectorConnection[];
  approvals: ConnectorApproval[];
};

type OverviewState = {
  userId: string;
  data?: ConnectorOverview;
  loading: boolean;
  unauthorized: boolean;
  error: string | null;
};

const EMPTY_OVERVIEW: ConnectorOverview = {
  availability: [],
  connections: [],
  approvals: [],
};

export function usePluginConnections() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<OverviewState | null>(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId || authLoading) return;
    const sequence = ++requestSequence.current;
    setState((previous) => ({
      userId,
      data: previous?.userId === userId ? previous.data : undefined,
      loading: true,
      unauthorized: false,
      error: null,
    }));
    try {
      const data = await apiFetch<ConnectorOverview>("/api/v1/plugins", {
        cache: "no-store",
      });
      if (sequence !== requestSequence.current) return;
      setState({
        userId,
        data,
        loading: false,
        unauthorized: false,
        error: null,
      });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      const unauthorized = error instanceof ApiError && error.status === 401;
      // Clear stale connection/approval data on authentication or network errors.
      setState({
        userId,
        loading: false,
        unauthorized,
        error: unauthorized
          ? null
          : "Unable to load your connections. Please retry.",
      });
    }
  }, [userId, authLoading]);

  useEffect(() => {
    void refresh();
    const onReturn = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onReturn);
    window.addEventListener("plugin-connections-changed", onReturn);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      requestSequence.current++;
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("plugin-connections-changed", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Never expose a previous account's overview during an identity transition.
  const current = userId && state?.userId === userId ? state : null;
  return {
    ...(current?.data ?? EMPTY_OVERVIEW),
    loading: authLoading || (!!userId && (!current || current.loading)),
    unauthorized: !authLoading && (!userId || current?.unauthorized === true),
    error: current?.error ?? null,
    refresh,
  };
}

export type PluginConnections = ReturnType<typeof usePluginConnections>;
