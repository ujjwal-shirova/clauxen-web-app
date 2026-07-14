"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { useAuth } from "@/frontend/hooks/use-auth";
import * as settingsApi from "@/frontend/lib/api/settings";
import type { GeneralSettings } from "@/frontend/lib/api/settings";
import { DEFAULT_APP_SETTINGS } from "@/frontend/lib/settings-defaults";
import { normalizeAppSettings } from "@/frontend/lib/settings-normalize";
import {
  applyDocumentPreferenceAttrs,
  appearanceToNextTheme,
  colorModeForAppearance,
  normalizeChatFontId,
  persistAppearanceLocal,
} from "@/lib/app-preferences";

type AppPreferencesContextValue = {
  general: GeneralSettings;
  loading: boolean;
  /** Optimistic local update + DOM apply + debounced Supabase persist. */
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  refresh: () => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(
  null,
);

function PreferencesInner({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { setTheme } = useTheme();
  const [general, setGeneral] = useState<GeneralSettings>(
    DEFAULT_APP_SETTINGS.general,
  );
  const [loading, setLoading] = useState(true);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generalRef = useRef(general);
  generalRef.current = general;

  const applyGeneralToDom = useCallback(
    (next: GeneralSettings) => {
      const appearance = next.appearancePreset || "System";
      setTheme(appearanceToNextTheme(appearance));
      persistAppearanceLocal(appearance);
      applyDocumentPreferenceAttrs({
        chatFont: normalizeChatFontId(next.chatFont),
        motion: next.motion ?? "System",
        followUpSuggestions: next.followUpSuggestions ?? true,
      });
    },
    [setTheme],
  );

  const refresh = useCallback(async () => {
    if (!user?.id) {
      const localAppearance =
        (typeof window !== "undefined"
          ? localStorage.getItem("clauxen.appearance")
          : null) || "System";
      const localFont =
        (typeof window !== "undefined"
          ? localStorage.getItem("clauxen.chatFont")
          : null) || "Default";
      const localMotion =
        (typeof window !== "undefined"
          ? localStorage.getItem("clauxen.motion")
          : null) || "System";
      const localFollowUp =
        typeof window !== "undefined"
          ? localStorage.getItem("clauxen.followUpSuggestions")
          : null;
      const next: GeneralSettings = {
        ...DEFAULT_APP_SETTINGS.general,
        appearancePreset: localAppearance,
        colorMode: colorModeForAppearance(localAppearance),
        chatFont: normalizeChatFontId(localFont),
        motion: localMotion === "Reduced" ? "Reduced" : "System",
        followUpSuggestions: localFollowUp !== "0",
      };
      setGeneral(next);
      applyGeneralToDom(next);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = normalizeAppSettings(await settingsApi.getSettings());
      const next = {
        ...data.general,
        chatFont: normalizeChatFontId(data.general.chatFont),
        colorMode: colorModeForAppearance(data.general.appearancePreset),
      };
      setGeneral(next);
      applyGeneralToDom(next);
    } catch {
      setGeneral((prev) => {
        applyGeneralToDom(prev);
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, applyGeneralToDom]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const updateGeneral = useCallback(
    (patch: Partial<GeneralSettings>) => {
      setGeneral((prev) => {
        const next: GeneralSettings = {
          ...prev,
          ...patch,
          ...(typeof patch.chatFont === "string"
            ? { chatFont: normalizeChatFontId(patch.chatFont) }
            : {}),
          ...(typeof patch.appearancePreset === "string"
            ? {
                appearancePreset: patch.appearancePreset,
                colorMode:
                  patch.colorMode ??
                  colorModeForAppearance(patch.appearancePreset),
              }
            : {}),
        };
        applyGeneralToDom(next);

        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => {
          if (!user?.id) return;
          void settingsApi
            .updateSettings({ general: next })
            .then((data) => {
              const normalized = normalizeAppSettings(data);
              setGeneral({
                ...normalized.general,
                chatFont: normalizeChatFontId(normalized.general.chatFont),
              });
            })
            .catch(() => {
              /* keep optimistic */
            });
        }, 400);

        return next;
      });
    },
    [applyGeneralToDom, user?.id],
  );

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const value = useMemo(
    () => ({ general, loading, updateGeneral, refresh }),
    [general, loading, updateGeneral, refresh],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange
    >
      <PreferencesInner>{children}</PreferencesInner>
    </ThemeProvider>
  );
}

export function useAppPreferences() {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useAppPreferences must be used within AppPreferencesProvider",
    );
  }
  return ctx;
}

/** Safe optional access when provider may be absent (e.g. isolated stories). */
export function useAppPreferencesOptional() {
  return useContext(AppPreferencesContext);
}
