"use client";

import { useCallback, useEffect, useState } from "react";
import * as artifactsApi from "@/frontend/lib/api/artifacts";
import type { ApiArtifact } from "@/frontend/lib/api/artifacts";

const ARTIFACT_KINDS = new Set([
  "app",
  "document",
  "spreadsheet",
  "presentation",
  "image",
  "code",
  "other",
]);
const MAX_ARTIFACT_TITLE_LENGTH = 200;

function normalizeArtifactKind(kind: string): string {
  if (kind === "template") return "other";
  return ARTIFACT_KINDS.has(kind) ? kind : "document";
}

export function useArtifacts(enabled: boolean) {
  // useState — React local state tuple [value, setter]
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);
  // useState — React local state tuple [value, setter]
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { artifacts: rows } = await artifactsApi.listArtifacts();
      setArtifacts(rows);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createArtifact = useCallback(
    async (title: string, kind = "document") => {
      const { artifact } = await artifactsApi.createArtifact({ title, kind });
      setArtifacts((prev) => [artifact, ...prev]);
      return artifact;
    },
    [],
  );

  return { artifacts, loading, refresh, createArtifact };
}
