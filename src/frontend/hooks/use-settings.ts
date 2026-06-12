"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as settingsApi from "@/frontend/lib/api/settings";
import type {
  AppSettings,
  GeneralSettings,
  NotificationSettings,
  PersonalizationSettings,
} from "@/frontend/lib/api/settings";
import { DEFAULT_APP_SETTINGS } from "@/frontend/lib/settings-defaults";

export function useSettings(enabled: boolean) {
  const [settings, setSettings] = useState<AppSettings | null>(() =>
    enabled ? null : DEFAULT_APP_SETTINGS,
  );
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSettings(DEFAULT_APP_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch {
      setSettings(DEFAULT_APP_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSettings(DEFAULT_APP_SETTINGS);
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const persist = useCallback(
    async (patch: Parameters<typeof settingsApi.updateSettings>[0]) => {
      if (!enabled) {
        setSettings((prev) => {
          const base = prev ?? DEFAULT_APP_SETTINGS;
          return {
            ...base,
            general: patch.general
              ? { ...base.general, ...patch.general }
              : base.general,
            personalization: patch.personalization
              ? { ...base.personalization, ...patch.personalization }
              : base.personalization,
            notifications: patch.notifications
              ? { ...base.notifications, ...patch.notifications }
              : base.notifications,
            claw: patch.claw ? { ...base.claw, ...patch.claw } : base.claw,
          };
        });
        return;
      }

      setSaving(true);
      try {
        const data = await settingsApi.updateSettings(patch);
        setSettings(data);
      } finally {
        setSaving(false);
      }
    },
    [enabled],
  );

  const updateGeneral = useCallback(
    (patch: Partial<GeneralSettings>) => {
      setSettings((prev) => {
        const base = prev ?? DEFAULT_APP_SETTINGS;
        return { ...base, general: { ...base.general, ...patch } };
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist({ general: patch });
      }, 400);
    },
    [persist],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationSettings>) => {
      setSettings((prev) => {
        const base = prev ?? DEFAULT_APP_SETTINGS;
        return {
          ...base,
          notifications: { ...base.notifications, ...patch },
        };
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist({ notifications: patch });
      }, 400);
    },
    [persist],
  );

  const updatePersonalization = useCallback(
    (patch: Partial<PersonalizationSettings>) => {
      setSettings((prev) => {
        const base = prev ?? DEFAULT_APP_SETTINGS;
        return {
          ...base,
          personalization: { ...base.personalization, ...patch },
        };
      });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist({ personalization: patch });
      }, 400);
    },
    [persist],
  );

  const createClawDeployment = useCallback(
    async (
      name: string,
      options: {
        status?: string;
        kind?: "persistent" | "on-demand" | "linked";
        endpoint?: string;
        webUiUrl?: string;
        terminalUrl?: string;
        fileManagerUrl?: string;
        gatewayWsUrl?: string;
        sandboxId?: string;
        model?: string;
        idleTimeoutSeconds?: number;
      } = {},
    ) => {
      const deployment = {
        id: crypto.randomUUID(),
        name,
        status: options.status ?? "ready",
        createdAt: new Date().toISOString(),
        ...options,
      };
      const current = settings?.claw.deployments ?? [];
      const next = [deployment, ...current];
      setSettings((prev) => {
        const base = prev ?? DEFAULT_APP_SETTINGS;
        return { ...base, claw: { deployments: next } };
      });
      await persist({ claw: { deployments: next } });
      return deployment;
    },
    [persist, settings?.claw.deployments],
  );

  return {
    settings,
    loading,
    saving,
    refresh,
    updateGeneral,
    updatePersonalization,
    updateNotifications,
    createClawDeployment,
    persist,
  };
}
