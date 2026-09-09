"use client";

import { useEffect } from "react";
import type { ChatFontId } from "@/lib/app-preferences";

/** Google Fonts CSS for preference fonts not bundled in the root layout. */
const CHAT_FONT_STYLESHEETS: Partial<Record<ChatFontId, string>> = {
  Lora: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  "Source Serif":
    "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap",
  Literata:
    "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600;7..72,700&display=swap",
  Newsreader:
    "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&display=swap",
  "Instrument Serif":
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
  Merriweather:
    "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  "IBM Plex Sans":
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  "Source Sans":
    "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap",
  "Nunito Sans":
    "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&display=swap",
  Manrope:
    "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap",
  "Plus Jakarta Sans":
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
  "DM Sans":
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
  "Atkinson Hyperlegible":
    "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
};

const LINK_ATTR = "data-clauxen-chat-font";

function ensureFontStylesheet(fontId: string) {
  const href = CHAT_FONT_STYLESHEETS[fontId as ChatFontId];
  if (!href) return;

  const existing = document.querySelector<HTMLLinkElement>(
    `link[${LINK_ATTR}="${fontId.replace(/"/g, "")}"]`,
  );
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(LINK_ATTR, fontId);
  link.media = "print";
  link.onload = () => {
    link.media = "all";
  };
  document.head.appendChild(link);
}

/** Prefetch every Google chat font so Settings picker labels render correctly. */
export function preloadChatFontCatalog() {
  if (typeof document === "undefined") return;
  for (const fontId of Object.keys(CHAT_FONT_STYLESHEETS)) {
    ensureFontStylesheet(fontId);
  }
}

/**
 * Loads only the selected chat font on demand.
 * Default / Sans / System use bundled Inter; Clauxen Serif uses Playfair.
 */
export function ChatFontLoader() {
  useEffect(() => {
    const sync = () => {
      const fontId =
        document.documentElement.getAttribute("data-chat-font") || "Default";
      ensureFontStylesheet(fontId);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-chat-font"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
