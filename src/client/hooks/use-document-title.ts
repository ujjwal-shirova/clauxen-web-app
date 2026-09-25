"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { parseOverlayHash } from "@/lib/app-routes";
import {
  DOCUMENT_TITLE_BRAND,
  formatChatTabTitle,
} from "@/lib/document-title";
import { projectTabTitle } from "@/lib/project-drafts";

const BRAND = DOCUMENT_TITLE_BRAND;

/** Soft-nav from useInstantNavigate dispatches this so tab titles stay in sync. */
export const CLAUXEN_NAVIGATE_EVENT = "clauxen:navigate";

function isChatPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    /^\/c\/[^/]+/.test(pathname)
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

  if (!pathname) return BRAND;

  // New-chat / home shell: brand only. Titled chats use "Title - Clauxen".
  if (pathname === "/new" || pathname === "/") {
    return BRAND;
  }

  const chatMatch = pathname.match(/^\/c\/([^/]+)/);
  if (chatMatch) return formatChatTabTitle(chatTitle);

  if (pathname === "/projects") return `Projects - ${BRAND}`;
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    const name = projectTabTitle(decodeURIComponent(projectMatch[1]));
    return name ? `${name} - ${BRAND}` : `Project - ${BRAND}`;
  }
  if (pathname.startsWith("/library")) return `Library - ${BRAND}`;
  if (pathname.startsWith("/scheduled")) return `Scheduled Tasks - ${BRAND}`;
  if (pathname.startsWith("/my-clauxen")) return `My Clauxen - ${BRAND}`;

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
        if (document.title !== BRAND) document.title = BRAND;
        return true;
      }

      const livePath =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      const hash = typeof window !== "undefined" ? window.location.hash : "";

      // Layout / non-chat owners: never overwrite a ChatView-owned tab title.
      if (!ownsChatTitle && isChatPath(livePath)) {
        return false;
      }

      // Name not hydrated yet — keep the server tab title instead of
      // replacing it with "Clauxen" or "Chat - Clauxen".
      if (ownsChatTitle && isChatPath(livePath) && !chatTitle?.trim()) {
        return true;
      }

      const next = titleForPath(
        livePath,
        ownsChatTitle ? chatTitle : null,
        hash,
      );
      if (document.title !== next) document.title = next;
      return true;
    };

    const ownsTitle = apply();

    const onNav = () => apply();
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    window.addEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);

    // Next's metadata title ("Chat - Clauxen") is applied after this effect.
    // Re-apply the chat title whenever that <title> node is rewritten.
    let titleEl = document.querySelector("title");
    const titleObserver = new MutationObserver(() => {
      const nextTitle = document.querySelector("title");
      if (nextTitle !== titleEl) {
        titleEl = nextTitle;
        if (titleEl) {
          titleObserver.observe(titleEl, {
            childList: true,
            characterData: true,
            subtree: true,
          });
        }
      }
      apply();
    });
    if (ownsTitle) {
      if (titleEl) {
        titleObserver.observe(titleEl, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      titleObserver.observe(document.head, { childList: true });
    }

    return () => {
      titleObserver.disconnect();
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
