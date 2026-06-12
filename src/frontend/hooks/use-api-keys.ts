"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/frontend/lib/api/client";

const API_KEY_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_KEY_NAME_MAX = 128;

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

export function useApiKeys(enabled: boolean) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ keys: ApiKeyRow[] }>("/api/v1/api-keys");
      setKeys(data.keys);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createKey = useCallback(
    async (name: string) => {
      const data = await apiFetch<{
        key: { id: string; key: string; prefix: string };
      }>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await refresh();
      return data.key;
    },
    [refresh],
  );

  const revokeKey = useCallback(
    async (keyId: string) => {
      if (!API_KEY_ID_RE.test(keyId)) {
        throw new ApiError("Invalid API key id.", 400);
      }
      await apiFetch(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh],
  );

  return { keys, loading, refresh, createKey, revokeKey };
}
