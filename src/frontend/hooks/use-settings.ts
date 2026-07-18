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
import { showSavedNotification } from "@/frontend/components/saved-notification";

type SettingsPatch = Parameters<typeof settingsApi.updateSettings>[0];

function mergeLocal(prev: AppSettings, patch: SettingsPatch): AppSettings {
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

function mergePatches(a: SettingsPatch, b: SettingsPatch): SettingsPatch {
  return {
    ...a,
    ...b,
    general: a.general || b.general ? { ...a.general, ...b.general } : undefined,
    personalization:
      a.personalization || b.personalization
        ? { ...a.personalization, ...b.personalization }
        : undefined,
    notifications:
      a.notifications || b.notifications
        ? { ...a.notifications, ...b.notifications }
        : undefined,
    privacy: a.privacy || b.privacy ? { ...a.privacy, ...b.privacy } : undefined,
    capabilities:
      a.capabilities || b.capabilities
        ? { ...a.capabilities, ...b.capabilities }
        : undefined,
    timeAndFocus:
      a.timeAndFocus || b.timeAndFocus
        ? { ...a.timeAndFocus, ...b.timeAndFocus }
        : undefined,
    reflect: a.reflect || b.reflect ? { ...a.reflect, ...b.reflect } : undefined,
    safety: a.safety || b.safety ? { ...a.safety, ...b.safety } : undefined,
    claw: a.claw || b.claw ? { ...a.claw, ...b.claw } : undefined,
  };
}

export function useSettings(enabled: boolean) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<SettingsPatch>({});
  const settingsRef = useRef(settings);
  const dirtyRef = useRef(false);
  settingsRef.current = settings;

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSettings(DEFAULT_APP_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await settingsApi.getSettings();
      // Never clobber in-flight optimistic edits with a stale GET.
      if (dirtyRef.current || Object.keys(pendingPatchRef.current).length > 0) {
        setSettings((prev) => prev);
        return;
      }
      setSettings(normalizeAppSettings(data));
    } catch {
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
    async (patch: SettingsPatch) => {
      if (!enabled) {
        setSettings((prev) => mergeLocal(prev, patch));
        return;
      }

      setSaving(true);
      try {
        await settingsApi.updateSettings(patch);
        // Keep optimistic local state — replacing from the PATCH response
        // caused 2–4s toggle flicker when GET/PATCH raced.
        dirtyRef.current = false;
        showSavedNotification();
      } catch {
        // Local optimistic state already applied; next refresh will reconcile.
      } finally {
        setSaving(false);
      }
    },
    [enabled],
  );

  const flushPending = useCallback(() => {
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!patch || Object.keys(patch).length === 0) return;
    void persist(patch);
  }, [persist]);

  const schedulePersist = useCallback(
    (patch: SettingsPatch) => {
      dirtyRef.current = true;
      setSettings((prev) => {
        const next = mergeLocal(prev, patch);
        settingsRef.current = next;
        return next;
      });
      pendingPatchRef.current = mergePatches(pendingPatchRef.current, patch);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Short debounce — UI is already updated; backend catches up quietly.
      // Blur-driven text fields (custom instructions, names) flush almost
      // immediately; toggle/picker patches still coalesce briefly.
      const delayMs =
        patch.personalization &&
        ("customInstructions" in (patch.personalization ?? {}) ||
          "fullName" in (patch.personalization ?? {}) ||
          "nickname" in (patch.personalization ?? {}))
          ? 0
          : 120;
      saveTimer.current = setTimeout(() => {
        flushPending();
      }, delayMs);
    },
    [flushPending],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

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
