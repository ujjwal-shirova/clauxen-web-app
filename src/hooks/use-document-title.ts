"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { parseOverlayHash } from "@/lib/app-routes";

const BRAND = "Clauxen";

/** Soft-nav from useInstantNavigate dispatches this so tab titles stay in sync. */
export const CLAUXEN_NAVIGATE_EVENT = "clauxen:navigate";

function isChatPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    /^\/c\/[^/]+/.test(pathname) ||
    /\/conversations\/[^/]+/.test(pathname)
  );
}

function titleForPath(
  pathname: string | null,
  chatTitle?: string | null,
  hash?: string | null,
): string {
  const overlay = parseOverlayHash(hash ?? null);
  if (overlay?.type === "settings") {
    return `${overlay.tab} - ${BRAND}`;
  }
  if (overlay?.type === "pricing") return `Upgrade - ${BRAND}`;
  if (overlay?.type === "gift") return `Gift - ${BRAND}`;
  if (overlay?.type === "apps") return `Apps - ${BRAND}`;

  if (!pathname) return BRAND;

  // New-chat / home shell: brand only. Titled chats use "Title - Clauxen".
  if (pathname === "/new" || pathname === "/") {
    return BRAND;
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

  if (
    pathname === "/project" ||
    pathname.startsWith("/project/") ||
    pathname.startsWith("/projects")
  ) {
    return `Projects - ${BRAND}`;
  }
  if (pathname.startsWith("/library")) return `Library - ${BRAND}`;
  if (pathname.startsWith("/my-clauxen")) return `My Clauxen - ${BRAND}`;
  if (pathname.startsWith("/customize/skills")) return `Skills - ${BRAND}`;
  if (pathname.startsWith("/customize/connectors")) {
    return `Connectors - ${BRAND}`;
  }
  if (pathname.startsWith("/customize")) return `Customize - ${BRAND}`;

  return BRAND;
}

/**
 * Keeps the browser tab title in sync with the current surface / chat title.
 * Use hyphen separators for titled surfaces: "Settings - Clauxen".
 * `/new` and `/` stay brand-only ("Clauxen").
 *
 * ChatView owns `/c/*` titles (pass `chatTitle`). Layout calls without a title
 * must not clobber those routes.
 */
export function useDocumentTitle(
  chatTitle?: string | null,
  options?: { brandOnly?: boolean },
) {
  const pathname = usePathname();
  const ownsChatTitle = chatTitle !== undefined;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = () => {
      if (options?.brandOnly) {
        document.title = BRAND;
        return;
      }

      const livePath =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      const hash =
        typeof window !== "undefined" ? window.location.hash : "";

      // Layout / non-chat owners: never overwrite a ChatView-owned tab title.
      if (!ownsChatTitle && isChatPath(livePath)) {
        return;
      }

      document.title = titleForPath(
        livePath,
        ownsChatTitle ? chatTitle : null,
        hash,
      );
    };

    apply();

    const onNav = () => apply();
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    window.addEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);
    return () => {
      window.removeEventListener("hashchange", onNav);
      window.removeEventListener("popstate", onNav);
      window.removeEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);
    };
  }, [pathname, chatTitle, options?.brandOnly, ownsChatTitle]);
}

export function setDocumentTitle(title: string) {
  if (typeof document === "undefined") return;
  document.title = title;
}

export { titleForPath, BRAND as DOCUMENT_TITLE_BRAND };
