"use client";

import { useCallback, useEffect, useState } from "react";
import * as researchApi from "@/frontend/lib/api/research";
import type { ApiResearchRun } from "@/frontend/lib/api/research";

// Client-side bounds — oversized payloads / malformed chat ids never leave the browser
const RESEARCH_OBJECTIVE_MAX_LEN = 16_384;
const CHAT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useResearch(enabled: boolean) {
  // useState — React local state tuple [value, setter]
  const [runs, setRuns] = useState<ApiResearchRun[]>([]);
  // useState — React local state tuple [value, setter]
  const [loading, setLoading] = useState(false);
  // useState — React local state tuple [value, setter]
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { runs: rows } = await researchApi.listResearchRuns();
      setRuns(rows);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startRun = useCallback(
    async (objective: string, chatId?: string) => {
      if (!enabled) return undefined;
      const trimmed = objective.trim();
      if (!trimmed) return undefined;
      const boundedObjective = trimmed.slice(0, RESEARCH_OBJECTIVE_MAX_LEN);
      const linkedChatId =
        chatId && CHAT_ID_RE.test(chatId) ? chatId : undefined;
      setCreating(true);
      try {
        const { run } = await researchApi.createResearchRun({
          objective: boundedObjective,
          chatId: linkedChatId,
        });
        setRuns((prev) => [run, ...prev]);
        return run;
        // catch — rejections must not become unhandled promise rejections
      } catch {
        return undefined;
      } finally {
        setCreating(false);
      }
    },
    [enabled],
  );

  return { runs, loading, creating, refresh, startRun };
}
