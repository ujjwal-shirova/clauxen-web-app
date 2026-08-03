/**
 * Chat / appearance preference ids stored in user_settings.settings.general.
 * Chat fonts style assistant markdown only (not app chrome labels).
 */

export const APPEARANCE_STORAGE_KEY = "clauxen.appearance";
export const CHAT_FONT_STORAGE_KEY = "clauxen.chatFont";
export const MOTION_STORAGE_KEY = "clauxen.motion";
export const FOLLOW_UP_STORAGE_KEY = "clauxen.followUpSuggestions";

export type AppearancePreset = "System" | "Light" | "Dark";
export type MotionPreset = "System" | "Reduced";

export type ChatFontId =
  | "Default"
  | "Sans"
  | "Lora"
  | "Source Serif"
  | "Literata"
  | "Newsreader"
  | "Instrument Serif"
  | "Merriweather"
  | "IBM Plex Sans"
  | "Source Sans"
  | "Nunito Sans"
  | "Manrope"
  | "Plus Jakarta Sans"
  | "DM Sans"
  | "Atkinson Hyperlegible"
  | "System";

export type ChatFontOption = {
  id: ChatFontId;
  /** Label shown in Settings → Chat font */
  label: string;
  /** CSS variable from root next/font (Default / Sans only). */
  cssVar?: string;
  /** Google Fonts family name when loaded on demand. */
  familyName?: string;
  stack: string;
};

export const CHAT_FONT_OPTIONS: readonly ChatFontOption[] = [
  {
    id: "Default",
    label: "Clauxen",
    cssVar: "--font-playfair",
    stack: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "Sans",
    label: "Inter",
    cssVar: "--font-inter",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Manrope",
    label: "Manrope",
    familyName: "Manrope",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Plus Jakarta Sans",
    label: "Plus Jakarta Sans",
    familyName: "Plus Jakarta Sans",
    stack: "system-ui, sans-serif",
  },
  {
    id: "DM Sans",
    label: "DM Sans",
    familyName: "DM Sans",
    stack: "system-ui, sans-serif",
  },
  {
    id: "IBM Plex Sans",
    label: "IBM Plex Sans",
    familyName: "IBM Plex Sans",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Source Sans",
    label: "Source Sans",
    familyName: "Source Sans 3",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Nunito Sans",
    label: "Nunito Sans",
    familyName: "Nunito Sans",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Atkinson Hyperlegible",
    label: "Atkinson Hyperlegible",
    familyName: "Atkinson Hyperlegible",
    stack: "system-ui, sans-serif",
  },
  {
    id: "Lora",
    label: "Lora",
    familyName: "Lora",
    stack: "Georgia, serif",
  },
  {
    id: "Source Serif",
    label: "Source Serif",
    familyName: "Source Serif 4",
    stack: "Georgia, serif",
  },
  {
    id: "Newsreader",
    label: "Newsreader",
    familyName: "Newsreader",
    stack: "Georgia, serif",
  },
  {
    id: "Literata",
    label: "Literata",
    familyName: "Literata",
    stack: "Georgia, serif",
  },
  {
    id: "Instrument Serif",
    label: "Instrument Serif",
    familyName: "Instrument Serif",
    stack: "Georgia, serif",
  },
  {
    id: "Merriweather",
    label: "Merriweather",
    familyName: "Merriweather",
    stack: "Georgia, serif",
  },
  {
    id: "System",
    label: "System",
    stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
] as const;

const CHAT_FONT_IDS = new Set(
  CHAT_FONT_OPTIONS.map((option) => option.id as string),
);

/** Normalize legacy / display labels to stored chat font ids. */
export function normalizeChatFontId(value: string | null | undefined): ChatFontId {
  const raw = (value ?? "Default").trim();
  if (raw === "Clauxen Serif" || raw === "Clauxen" || raw === "Default") {
    return "Default";
  }
  if (raw === "Dyslexic friendly") return "Atkinson Hyperlegible";
  if (CHAT_FONT_IDS.has(raw)) return raw as ChatFontId;
  return "Default";
}

export function chatFontOption(id: string | null | undefined): ChatFontOption {
  const normalized = normalizeChatFontId(id);
  return (
    CHAT_FONT_OPTIONS.find((option) => option.id === normalized) ??
    CHAT_FONT_OPTIONS[0]!
  );
}

export function appearanceToNextTheme(
  preset: string | null | undefined,
): "system" | "light" | "dark" {
  if (preset === "Light") return "light";
  if (preset === "Dark") return "dark";
  return "system";
}

export function nextThemeToAppearance(
  theme: string | undefined,
): AppearancePreset {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
}

export function colorModeForAppearance(preset: string): string {
  if (preset === "Light") return "Light";
  if (preset === "Dark") return "Dark";
  return "Auto";
}

export function normalizeMotionPreset(
  value: string | null | undefined,
): MotionPreset {
  return value === "Reduced" ? "Reduced" : "System";
}

function osPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Whether motion should be reduced for the given preset. */
export function shouldReduceMotion(motion: string | null | undefined): boolean {
  const preset = normalizeMotionPreset(motion);
  if (preset === "Reduced") return true;
  return osPrefersReducedMotion();
}

/** Apply non-theme document attrs (font + motion). Theme is owned by next-themes. */
export function applyDocumentPreferenceAttrs(input: {
  chatFont?: string | null;
  motion?: string | null;
  followUpSuggestions?: boolean | null;
}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (input.chatFont != null) {
    const fontId = normalizeChatFontId(input.chatFont);
    root.setAttribute("data-chat-font", fontId);
    try {
      localStorage.setItem(CHAT_FONT_STORAGE_KEY, fontId);
    } catch {
      /* ignore */
    }
  }

  if (input.motion != null) {
    const preset = normalizeMotionPreset(input.motion);
    const reduced = shouldReduceMotion(preset);
    if (reduced) root.setAttribute("data-reduce-motion", "1");
    else root.removeAttribute("data-reduce-motion");
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, preset);
    } catch {
      /* ignore */
    }
  }

  if (input.followUpSuggestions != null) {
    root.setAttribute(
      "data-follow-up-suggestions",
      input.followUpSuggestions ? "1" : "0",
    );
    try {
      localStorage.setItem(
        FOLLOW_UP_STORAGE_KEY,
        input.followUpSuggestions ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }
}

export function persistAppearanceLocal(preset: string) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, preset);
  } catch {
    /* ignore */
  }
}

/** Read cached general prefs from localStorage for instant paint (no mock flash). */
export function readLocalGeneralPrefs(): {
  appearancePreset: AppearancePreset;
  chatFont: ChatFontId;
  motion: MotionPreset;
  followUpSuggestions: boolean;
} {
  if (typeof window === "undefined") {
    return {
      appearancePreset: "System",
      chatFont: "Default",
      motion: "System",
      followUpSuggestions: true,
    };
  }
  try {
    const appearanceRaw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const themeRaw = localStorage.getItem("theme");
    let appearancePreset: AppearancePreset = "System";
    if (appearanceRaw === "Light" || appearanceRaw === "Dark" || appearanceRaw === "System") {
      appearancePreset = appearanceRaw;
    } else if (themeRaw === "light") {
      appearancePreset = "Light";
    } else if (themeRaw === "dark") {
      appearancePreset = "Dark";
    }

    const followRaw = localStorage.getItem(FOLLOW_UP_STORAGE_KEY);
    return {
      appearancePreset,
      chatFont: normalizeChatFontId(localStorage.getItem(CHAT_FONT_STORAGE_KEY)),
      motion: normalizeMotionPreset(localStorage.getItem(MOTION_STORAGE_KEY)),
      followUpSuggestions: followRaw !== "0",
    };
  } catch {
    return {
      appearancePreset: "System",
      chatFont: "Default",
      motion: "System",
      followUpSuggestions: true,
    };
  }
}
