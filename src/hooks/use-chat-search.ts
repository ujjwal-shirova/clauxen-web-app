"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SearchInbound,
  SearchIndexEntry,
  SearchOutbound,
} from "@/workers/search.worker";

let searchWorker: Worker | null = null;

function getSearchWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!searchWorker) {
    try {
      searchWorker = new Worker(
        new URL("../workers/search.worker.ts", import.meta.url),
      );
    } catch {
      return null;
    }
  }
  return searchWorker;
}

export function useChatSearch(chatId?: string | null) {
  const workerRef = useRef<Worker | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    workerRef.current = getSearchWorker();
    const worker = workerRef.current;
    if (!worker) return;

    const handler = (event: MessageEvent<SearchOutbound>) => {
      if (event.data.type === "results") {
        setResults(event.data.messageIds);
        setIsSearching(false);
      }
    };
    worker.addEventListener("message", handler);
    return () => worker.removeEventListener("message", handler);
  }, []);

  const rebuildIndex = useCallback((entries: SearchIndexEntry[]) => {
    workerRef.current?.postMessage({
      type: "rebuild",
      entries,
    } satisfies SearchInbound);
  }, []);

  const addToIndex = useCallback((entry: SearchIndexEntry) => {
    workerRef.current?.postMessage({
      type: "add",
      entry,
    } satisfies SearchInbound);
  }, []);

  const search = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      workerRef.current?.postMessage({
        type: "query",
        query,
        chatId: chatId ?? undefined,
      } satisfies SearchInbound);
    },
    [chatId],
  );

  return { results, isSearching, search, rebuildIndex, addToIndex };
}
