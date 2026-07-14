"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  parseOverlayHash,
} from "@/frontend/lib/app-routes";

const BRAND = "Clauxen";

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
    const hash =
      typeof window !== "undefined" ? window.location.hash : "";
    document.title = titleForPath(livePath, chatTitle, hash);

    const onHash = () => {
      document.title = titleForPath(
        window.location.pathname,
        chatTitle,
        window.location.hash,
      );
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, [pathname, chatTitle, options?.brandOnly]);
}

export function setDocumentTitle(title: string) {
  if (typeof document === "undefined") return;
  document.title = title;
}

export { titleForPath, BRAND as DOCUMENT_TITLE_BRAND };
