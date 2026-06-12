"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as workspacesApi from "@/frontend/lib/api/workspaces";
import { ApiError } from "@/frontend/lib/api/client";
import type {
  SsoConnection,
  Workspace,
  WorkspaceDomain,
  WorkspaceMember,
} from "@/frontend/lib/api/workspaces";

function enterpriseLoadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403 || err.status >= 500) {
      return "Failed to load enterprise settings.";
    }
    return err.message;
  }
  return "Failed to load enterprise settings.";
}

export function useEnterprise() {
  // useState — React local state tuple [value, setter]
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  // useState — React local state tuple [value, setter]
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  // useState — React local state tuple [value, setter]
  const [ssoConnections, setSsoConnections] = useState<SsoConnection[]>([]);
  // useState — React local state tuple [value, setter]
  const [domains, setDomains] = useState<WorkspaceDomain[]>([]);
  // useState — React local state tuple [value, setter]
  const [scimStubMessage, setScimStubMessage] = useState<string | null>(null);
  // useState — React local state tuple [value, setter]
  const [loading, setLoading] = useState(true);
  // useState — React local state tuple [value, setter]
  const [error, setError] = useState<string | null>(null);
  const refreshGenRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGenRef.current;
    setLoading(true);
    setError(null);
    try {
      const [current, memberData, ssoData, domainData, scimData] =
        await Promise.all([
          workspacesApi.getCurrentWorkspace(),
          workspacesApi.getWorkspaceMembers(),
          workspacesApi.getSsoConnections(),
          workspacesApi.getWorkspaceDomains(),
          workspacesApi.getScimTokens(),
        ]);

      if (generation !== refreshGenRef.current) return;

      setWorkspace(current.workspace ?? memberData.workspace);
      setMembers(memberData.members);
      setSsoConnections(ssoData.connections);
      setDomains(domainData.domains);
      setScimStubMessage(scimData.stub ? (scimData.message ?? null) : null);
      // catch — exception handle; UI/state fallback
    } catch (err) {
      if (generation !== refreshGenRef.current) return;
      setError(enterpriseLoadErrorMessage(err));
    } finally {
      if (generation === refreshGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    workspace,
    members,
    ssoConnections,
    domains,
    scimStubMessage,
    loading,
    error,
    refresh,
  };
}
