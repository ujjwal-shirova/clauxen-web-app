"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { normalizeSettingsTab } from "@/frontend/lib/app-routes";

const BRAND = "Clauxen";

function titleForPath(
  pathname: string | null,
  chatTitle?: string | null,
): string {
  if (!pathname) return BRAND;

  if (pathname === "/new" || pathname === "/") {
    return `New chat - ${BRAND}`;
  }

  const chatMatch = pathname.match(/^\/c\/([^/]+)/);
  if (chatMatch) {
    const name = chatTitle?.trim();
    if (!name || /^new chat$/i.test(name)) return BRAND;
    return `${name} - ${BRAND}`;
  }

  const projectConv = pathname.match(
    /^\/projects\/[^/]+\/conversations\/([^/]+)/,
  );
  if (projectConv) {
    const name = chatTitle?.trim();
    if (!name || /^new chat$/i.test(name)) return BRAND;
    return `${name} - ${BRAND}`;
  }

  if (pathname.startsWith("/projects")) return `Projects - ${BRAND}`;
  if (pathname.startsWith("/library")) return `Library - ${BRAND}`;
  if (pathname.startsWith("/customize/skills")) return `Skills - ${BRAND}`;
  if (pathname.startsWith("/customize/connectors")) {
    return `Connectors - ${BRAND}`;
  }
  if (pathname.startsWith("/customize")) return `Customize - ${BRAND}`;
  if (pathname === "/upgrade" || pathname === "/pricing") {
    return `Upgrade - ${BRAND}`;
  }
  if (pathname === "/gift") return `Gift - ${BRAND}`;
  if (pathname === "/apps") return `Apps - ${BRAND}`;

  const settings = pathname.match(/^\/settings(?:\/([^/]+))?/);
  if (settings) {
    const tab = normalizeSettingsTab(settings[1] || "general");
    return `${tab} - ${BRAND}`;
  }

  return BRAND;
}

/**
 * Keeps the browser tab title in sync with the current surface / chat title.
 * Use hyphen separators: "New chat - Clauxen".
 */
export function useDocumentTitle(
  chatTitle?: string | null,
  options?: { brandOnly?: boolean },
) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (options?.brandOnly) {
      document.title = BRAND;
      return;
    }
    const livePath =
      typeof window !== "undefined" ? window.location.pathname : pathname;
    document.title = titleForPath(livePath, chatTitle);
  }, [pathname, chatTitle, options?.brandOnly]);
}

export function setDocumentTitle(title: string) {
  if (typeof document === "undefined") return;
  document.title = title;
}

export { titleForPath, BRAND as DOCUMENT_TITLE_BRAND };
