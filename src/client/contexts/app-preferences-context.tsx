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
import { MotionConfig } from "framer-motion";
import { ThemeProvider, useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import * as settingsApi from "@/lib/api/settings";
import type { GeneralSettings } from "@/lib/api/settings";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings-defaults";
import { normalizeAppSettings } from "@/lib/settings-normalize";
import {
  applyDocumentPreferenceAttrs,
  appearanceToNextTheme,
  colorModeForAppearance,
  normalizeChatFontId,
  normalizeMotionPreset,
  persistAppearanceLocal,
  readLocalGeneralPrefs,
} from "@/lib/app-preferences";
import { showSavedNotification } from "@/components/saved-notification";

type AppPreferencesContextValue = {
  general: GeneralSettings;
  /** True until first hydrate (local or remote) finishes. */
  loading: boolean;
  /** True after the first successful hydrate; subsequent refreshes stay quiet. */
  ready: boolean;
  /** Optimistic local update + DOM apply + debounced Supabase persist. */
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(
  null,
);

function buildGeneralFromLocal(): GeneralSettings {
  const local = readLocalGeneralPrefs();
  return {
    ...DEFAULT_APP_SETTINGS.general,
    appearancePreset: local.appearancePreset,
    colorMode: colorModeForAppearance(local.appearancePreset),
    chatFont: local.chatFont,
    motion: local.motion,
    followUpSuggestions: local.followUpSuggestions,
  };
}

function PreferencesInner({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [general, setGeneral] = useState<GeneralSettings>(() =>
    typeof window === "undefined"
      ? DEFAULT_APP_SETTINGS.general
      : buildGeneralFromLocal(),
  );
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [osReduced, setOsReduced] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generalRef = useRef(general);
  const dirtyRef = useRef(false);
  const persistEpoch = useRef(0);
  generalRef.current = general;

  useEffect(() => {
    if (resolvedTheme !== "dark" && resolvedTheme !== "light") return;
    const root = document.documentElement;
    root.style.colorScheme = resolvedTheme;
    root.dataset.resolvedTheme = resolvedTheme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#111113" : "#f4f4f3",
      );
  }, [resolvedTheme]);

  const applyGeneralToDom = useCallback(
    (next: GeneralSettings) => {
      const appearance = next.appearancePreset || "System";
      setTheme(appearanceToNextTheme(appearance));
      persistAppearanceLocal(appearance);
      applyDocumentPreferenceAttrs({
        chatFont: normalizeChatFontId(next.chatFont),
        motion: normalizeMotionPreset(next.motion),
        followUpSuggestions: next.followUpSuggestions ?? true,
      });
    },
    [setTheme],
  );

  // Instant paint from localStorage before auth/settings resolve (once).
  useEffect(() => {
    const local = buildGeneralFromLocal();
    setGeneral(local);
    applyGeneralToDom(local);
  }, []);

  // Keep System motion in sync with OS preference changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setOsReduced(mq.matches);
      if (normalizeMotionPreset(generalRef.current.motion) === "System") {
        applyDocumentPreferenceAttrs({ motion: "System" });
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const refresh = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet ?? ready;
      if (!user?.id) {
        const next = buildGeneralFromLocal();
        setGeneral(next);
        applyGeneralToDom(next);
        setLoading(false);
        setReady(true);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const data = normalizeAppSettings(await settingsApi.getSettings());
        // Never clobber in-flight optimistic edits with a stale GET.
        if (dirtyRef.current) {
          return;
        }
        const next = {
          ...data.general,
          chatFont: normalizeChatFontId(data.general.chatFont),
          motion: normalizeMotionPreset(data.general.motion),
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
        setReady(true);
      }
    },
    [user?.id, applyGeneralToDom, ready],
  );

  useEffect(() => {
    // Fire settings as soon as we have an identity (hint or JWT). Waiting on
    // auth.loading used to serialize settings behind the quiet session call.
    if (!user?.id && authLoading) return;
    void refresh({ quiet: ready });
  }, [authLoading, user?.id]);

  const updateGeneral = useCallback(
    (patch: Partial<GeneralSettings>) => {
      dirtyRef.current = true;
      const epoch = ++persistEpoch.current;

      setGeneral((prev) => {
        const next: GeneralSettings = {
          ...prev,
          ...patch,
          ...(typeof patch.chatFont === "string"
            ? { chatFont: normalizeChatFontId(patch.chatFont) }
            : {}),
          ...(typeof patch.motion === "string"
            ? { motion: normalizeMotionPreset(patch.motion) }
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
        generalRef.current = next;
        // UI first — theme / font / motion apply before any network work.
        applyGeneralToDom(next);

        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => {
          if (!user?.id) {
            dirtyRef.current = false;
            return;
          }
          const snapshot = generalRef.current;
          void settingsApi
            .updateSettings({ general: snapshot })
            .then(() => {
              // Ignore stale responses from rapid toggles.
              if (epoch !== persistEpoch.current) return;
              dirtyRef.current = false;
              showSavedNotification();
            })
            .catch(() => {
              if (epoch === persistEpoch.current) {
                dirtyRef.current = false;
              }
              /* keep optimistic UI */
            });
        }, 280);

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

  const reduceMotion =
    general.motion === "Reduced" ||
    (normalizeMotionPreset(general.motion) === "System" && osReduced);

  const value = useMemo(
    () => ({ general, loading, ready, updateGeneral, refresh }),
    [general, loading, ready, updateGeneral, refresh],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
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
