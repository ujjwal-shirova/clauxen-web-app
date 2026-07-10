"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as settingsApi from "@/frontend/lib/api/settings";
import type {
  AppSettings,
  CapabilitiesSettings,
  GeneralSettings,
  NotificationSettings,
  PersonalizationSettings,
  PrivacySettings,
  ReflectSettings,
  SafetySettings,
  TimeAndFocusSettings,
} from "@/frontend/lib/api/settings";
import { DEFAULT_APP_SETTINGS } from "@/frontend/lib/settings-defaults";
import { normalizeAppSettings } from "@/frontend/lib/settings-normalize";

function mergeLocal(
  prev: AppSettings,
  patch: Parameters<typeof settingsApi.updateSettings>[0],
): AppSettings {
  return normalizeAppSettings({
    ...prev,
    general: patch.general ? { ...prev.general, ...patch.general } : prev.general,
    personalization: patch.personalization
      ? { ...prev.personalization, ...patch.personalization }
      : prev.personalization,
    notifications: patch.notifications
      ? { ...prev.notifications, ...patch.notifications }
      : prev.notifications,
    privacy: patch.privacy ? { ...prev.privacy, ...patch.privacy } : prev.privacy,
    capabilities: patch.capabilities
      ? { ...prev.capabilities, ...patch.capabilities }
      : prev.capabilities,
    timeAndFocus: patch.timeAndFocus
      ? { ...prev.timeAndFocus, ...patch.timeAndFocus }
      : prev.timeAndFocus,
    reflect: patch.reflect ? { ...prev.reflect, ...patch.reflect } : prev.reflect,
    safety: patch.safety ? { ...prev.safety, ...patch.safety } : prev.safety,
    claw: patch.claw ? { ...prev.claw, ...patch.claw } : prev.claw,
  });
}

export function useSettings(enabled: boolean) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
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
      setSettings(normalizeAppSettings(data));
    } catch {
      // Keep current defaults — never clear the UI on API/challenge failures.
      setSettings((prev) => normalizeAppSettings(prev));
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
        setSettings((prev) => mergeLocal(prev, patch));
        return;
      }

      setSaving(true);
      try {
        const data = await settingsApi.updateSettings(patch);
        setSettings(normalizeAppSettings(data));
      } catch {
        // Optimistic local state already applied via schedulePersist.
      } finally {
        setSaving(false);
      }
    },
    [enabled],
  );

  const schedulePersist = useCallback(
    (patch: Parameters<typeof settingsApi.updateSettings>[0]) => {
      setSettings((prev) => mergeLocal(prev, patch));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(patch);
      }, 400);
    },
    [persist],
  );

  const updateGeneral = useCallback(
    (patch: Partial<GeneralSettings>) => schedulePersist({ general: patch }),
    [schedulePersist],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationSettings>) =>
      schedulePersist({ notifications: patch }),
    [schedulePersist],
  );

  const updatePersonalization = useCallback(
    (patch: Partial<PersonalizationSettings>) =>
      schedulePersist({ personalization: patch }),
    [schedulePersist],
  );

  const updatePrivacy = useCallback(
    (patch: Partial<PrivacySettings>) => schedulePersist({ privacy: patch }),
    [schedulePersist],
  );

  const updateCapabilities = useCallback(
    (patch: Partial<CapabilitiesSettings>) =>
      schedulePersist({ capabilities: patch }),
    [schedulePersist],
  );

  const updateTimeAndFocus = useCallback(
    (patch: Partial<TimeAndFocusSettings>) =>
      schedulePersist({ timeAndFocus: patch }),
    [schedulePersist],
  );

  const updateReflect = useCallback(
    (patch: Partial<ReflectSettings>) => schedulePersist({ reflect: patch }),
    [schedulePersist],
  );

  const updateSafety = useCallback(
    (patch: Partial<SafetySettings>) => schedulePersist({ safety: patch }),
    [schedulePersist],
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
      const current = settings.claw.deployments ?? [];
      const next = [deployment, ...current];
      setSettings((prev) =>
        normalizeAppSettings({ ...prev, claw: { deployments: next } }),
      );
      await persist({ claw: { deployments: next } });
      return deployment;
    },
    [persist, settings.claw.deployments],
  );

  return {
    settings,
    loading,
    saving,
    refresh,
    updateGeneral,
    updatePersonalization,
    updateNotifications,
    updatePrivacy,
    updateCapabilities,
    updateTimeAndFocus,
    updateReflect,
    updateSafety,
    createClawDeployment,
    persist,
  };
}
