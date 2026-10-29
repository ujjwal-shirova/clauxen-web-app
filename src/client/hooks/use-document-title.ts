"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DOCUMENT_TITLE_BRAND,
  formatChatTabTitle,
  formatProjectTabTitle,
} from "@/lib/document-title";

const BRAND = DOCUMENT_TITLE_BRAND;

/** Soft-nav from useInstantNavigate dispatches this so tab titles stay in sync. */
export const CLAUXEN_NAVIGATE_EVENT = "clauxen:navigate";

const CHAT_PATH = /^\/c\/[^/]+/;
const PROJECT_PATH = /^\/projects\/[^/]+/;

function isChatPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname && CHAT_PATH.test(pathname));
}

function isProjectPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname && PROJECT_PATH.test(pathname));
}

function titleForPath(
  pathname: string | null,
  chatTitle?: string | null,
): string {
  if (!pathname) return BRAND;

  // Named chats keep their title. Every other app surface is just "Clauxen".
  if (CHAT_PATH.test(pathname)) return formatChatTabTitle(chatTitle);

  return BRAND;
}

/**
 * Keeps the browser tab title in sync. The app title is always "Clauxen".
 * Named chats use "Title - Clauxen".
 *
 * ChatView owns `/c/*` titles (pass `chatTitle`) and ProjectDashboard owns
 * `/projects/*` via useProjectDocumentTitle. Layout calls without a title must
 * not clobber either.
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

      // Layout / non-chat owners: never overwrite a title owned by a surface.
      if (!ownsChatTitle && (isChatPath(livePath) || isProjectPath(livePath))) {
        return false;
      }
      if (ownsChatTitle && isProjectPath(livePath)) return false;

      // Name not hydrated yet — keep the server tab title instead of
      // replacing it with "Clauxen" or "Chat - Clauxen".
      if (ownsChatTitle && isChatPath(livePath) && !chatTitle?.trim()) {
        return true;
      }

      const next = titleForPath(livePath, ownsChatTitle ? chatTitle : null);
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

/**
 * Owns the tab title while a project dashboard is open, so a client soft-nav
 * into `/projects/:id` shows the project name without a server round trip.
 */
export function useProjectDocumentTitle(name: string | null | undefined) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const apply = () => {
      const livePath = window.location.pathname;
      if (!isProjectPath(livePath)) return;
      // Name not loaded yet — leave the server-rendered title in place.
      if (!name?.trim()) return;
      const next = formatProjectTabTitle(name);
      if (document.title !== next) document.title = next;
    };

    apply();

    const onNav = () => apply();
    window.addEventListener("popstate", onNav);
    window.addEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);

    const titleObserver = new MutationObserver(apply);
    titleObserver.observe(document.head, { childList: true, subtree: true });

    return () => {
      titleObserver.disconnect();
      window.removeEventListener("popstate", onNav);
      window.removeEventListener(CLAUXEN_NAVIGATE_EVENT, onNav);
    };
  }, [pathname, name]);
}

export function setDocumentTitle(title: string) {
  if (typeof document === "undefined") return;
  document.title = title;
}

export { titleForPath, BRAND as DOCUMENT_TITLE_BRAND };
