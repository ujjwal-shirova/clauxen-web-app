"use client";

import React, { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { SoftErrorBoundary } from "@/components/soft-error-boundary";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/contexts/auth-gate-context";
import { sidebarDisplayNameOrNull } from "@/lib/profile-names";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import {
  appAgentPanelClassName,
  appMainShellClassName,
  appShellRootClassName,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";
import type { SettingsTab } from "@/components/settings/constants";
import type { RecentChat } from "@/lib/types";
import { AppLayoutProvider } from "@/components/app-layout-context";
import {
  ChatSessionProvider,
  useChatSession,
} from "@/contexts/chat-session-context";
import { AppOverlayHost } from "@/components/app-overlay-host";
import { AppOverlaysProvider, useAppOverlays } from "@/hooks/use-app-overlays";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { readIdentityHintFromDocument } from "@/utils/identity-cookie";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { APP_ROUTES, isIncognitoPath } from "@/lib/app-routes";
import { AppPageSurface } from "@/components/app-page-surface";
import { Sidebar } from "@/ui/shell/sidebar";
import { SidebarToggleIcon } from "@/components/icons";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";
import { AppKeyboardController } from "@/components/keyboard/app-keyboard-controller";

const MOBILE_FULL_BLEED_PREFIXES = [
  "/library",
  "/my-clauxen",
  "/incognito",
] as const;

const APP_SHELL_PREFETCH_ROUTES = [
  APP_ROUTES.newChat,
  APP_ROUTES.library,
  APP_ROUTES.myClauxen,
] as const;

function shouldMobileFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;
  return MOBILE_FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = useAppPathname();
  const nextPathname = usePathname() || "";
  const isIncognito = isIncognitoPath(pathname);
  const instantNavigate = useInstantNavigate();
  const auth = useAuth();
  const authGate = useAuthGate();
  const {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  } = useSidebarState();
  const [isSidebarPeekOpen, setIsSidebarPeekOpen] = React.useState(false);
  const [sidebarPeekArmed, setSidebarPeekArmed] = React.useState(true);
  const sidebarPeekCloseTimerRef = React.useRef<number | null>(null);

  const cancelSidebarPeekClose = useCallback(() => {
    if (sidebarPeekCloseTimerRef.current === null) return;
    window.clearTimeout(sidebarPeekCloseTimerRef.current);
    sidebarPeekCloseTimerRef.current = null;
  }, []);

  const openSidebarPeek = useCallback(() => {
    if (isMobile || !isSidebarCollapsed || !sidebarPeekArmed) return;
    cancelSidebarPeekClose();
    setIsSidebarPeekOpen(true);
  }, [
    cancelSidebarPeekClose,
    isMobile,
    isSidebarCollapsed,
    sidebarPeekArmed,
  ]);

  const closeSidebarPeekSoon = useCallback(() => {
    if (isMobile || !isSidebarCollapsed) return;
    cancelSidebarPeekClose();
    sidebarPeekCloseTimerRef.current = window.setTimeout(() => {
      setIsSidebarPeekOpen(false);
      sidebarPeekCloseTimerRef.current = null;
    }, 260);
  }, [cancelSidebarPeekClose, isMobile, isSidebarCollapsed]);

  const setSidebarCollapsedFromNav = useCallback(
    (collapsed: boolean) => {
      cancelSidebarPeekClose();
      setIsSidebarPeekOpen(false);
      // A click that collapses while the pointer is still on the control
      // must not immediately open the hover sidebar.
      setSidebarPeekArmed(!collapsed);
      setIsSidebarCollapsed(collapsed);
    },
    [cancelSidebarPeekClose, setIsSidebarCollapsed],
  );

  React.useEffect(() => {
    if (sidebarPeekArmed || isMobile || !isSidebarCollapsed) return;
    const onMove = (event: PointerEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (hit?.closest(".app-sidebar-peek-toggle, .app-sidebar-slot")) return;
      setSidebarPeekArmed(true);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [isMobile, isSidebarCollapsed, sidebarPeekArmed]);

  React.useEffect(() => {
    if (!isSidebarCollapsed || isMobile) setIsSidebarPeekOpen(false);
  }, [isMobile, isSidebarCollapsed]);

  React.useEffect(
    () => () => {
      if (sidebarPeekCloseTimerRef.current !== null) {
        window.clearTimeout(sidebarPeekCloseTimerRef.current);
      }
    },
    [],
  );

  const handleToggleSidebarShortcut = useCallback(() => {
    if (isMobile || isIncognito) return;
    setSidebarCollapsedFromNav(!isSidebarCollapsed);
  }, [isIncognito, isMobile, isSidebarCollapsed, setSidebarCollapsedFromNav]);

  useDocumentTitle();

  React.useEffect(() => {
    if (auth.loading || !auth.user?.id) return;
    for (const route of APP_SHELL_PREFETCH_ROUTES) {
      router.prefetch(route);
    }
  }, [auth.loading, auth.user?.id, router]);

  // Guest preview: unauthenticated visitors keep the app shell. Actions that
  // need a session open the in-app sign-in dialog (AuthGateProvider) instead
  // of bouncing to a standalone login page.

  // Boot: `/` → `/new` once identity resolves (preserve overlay hash).
  // Guests land on the `/new` preview too — the composer is the entry point.
  React.useEffect(() => {
    if (pathname !== "/") return;
    if (auth.loading) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    instantNavigate(`${APP_ROUTES.newChat}${hash}`, { replace: true });
  }, [pathname, auth.loading, instantNavigate]);

  const chat = useChatSession();
  const {
    startedRecentChats,
    activeChatId,
    creatingChatPending,
    loading: chatsLoading,
    generatingChatIds,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    startNewChat,
  } = chat;

  const overlays = useAppOverlays();

  React.useEffect(() => {
    if (!auth.user?.id) return;
    router.prefetch(APP_ROUTES.newChat);
  }, [auth.user?.id, router]);

  const closeMobileNav = useCallback(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [isMobile, setIsSidebarCollapsed]);

  const handleSidebarNavigate = useCallback(() => {
    closeMobileNav();
    if (!isMobile && isSidebarCollapsed) {
      cancelSidebarPeekClose();
      setIsSidebarPeekOpen(false);
    }
  }, [cancelSidebarPeekClose, closeMobileNav, isMobile, isSidebarCollapsed]);

  React.useEffect(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [pathname, isMobile, setIsSidebarCollapsed]);

  const handleNewChat = useCallback(() => {
    closeMobileNav();
    if (overlays.currentOverlay) {
      overlays.closeOverlay();
      return;
    }
    if (pathname === APP_ROUTES.newChat || pathname === "/") {
      startNewChat();
      return;
    }
    instantNavigate(APP_ROUTES.newChat, { replace: true });
    // Navigation is announced synchronously, so clearing the old chat here
    // cannot be re-selected by the previous route and the new page paints now.
    startNewChat();
  }, [startNewChat, closeMobileNav, overlays, pathname, instantNavigate]);

  const onSelectChatFromSidebar = useCallback(
    (_chatEntry: RecentChat) => {
      closeMobileNav();
    },
    [closeMobileNav],
  );

  const onDeleteChatFromSidebar = useCallback(
    (chatId: string) => {
      const wasActive =
        activeChatId === chatId ||
        getRouteChatIdForSidebar(pathname) === chatId;
      // Optimistic delete updates the sidebar synchronously; navigate away
      // immediately when the open chat was removed.
      void handleDeleteChat(chatId);
      if (wasActive) {
        instantNavigate(APP_ROUTES.newChat, { replace: true });
      }
      closeMobileNav();
    },
    [activeChatId, closeMobileNav, handleDeleteChat, instantNavigate, pathname],
  );

  const onUpgradeClick = useCallback(() => {
    overlays.openPricing();
    closeMobileNav();
  }, [overlays, closeMobileNav]);

  const onSettingsClick = useCallback(
    (tab: SettingsTab = "General") => {
      if (!authGate.requireAuth()) return;
      overlays.openSettings(tab);
      closeMobileNav();
    },
    [authGate, overlays, closeMobileNav],
  );

  const onPersonalizationClick = useCallback(() => {
    if (!authGate.requireAuth()) return;
    overlays.openSettings("Personalization");
    closeMobileNav();
  }, [authGate, overlays, closeMobileNav]);

  const onGiftClick = useCallback(() => {
    if (!authGate.requireAuth()) return;
    overlays.openGift();
    closeMobileNav();
  }, [authGate, overlays, closeMobileNav]);

  const isMobileFullBleed = isMobile && shouldMobileFullBleed(pathname);

  const sidebarActiveChatId = React.useMemo(() => {
    const routeId = getRouteChatIdForSidebar(pathname);
    if (routeId) return routeId;

    const p = pathname || "";
    if (
      p === "/" ||
      p === "/new" ||
      p === "/incognito" ||
      p.startsWith("/incognito/") ||
      p === "/library"
    ) {
      return null;
    }
    return activeChatId;
  }, [pathname, activeChatId]);

  const layoutValue = React.useMemo(
    () => ({
      isMobile,
      isSidebarCollapsed: isIncognito ? true : isSidebarCollapsed,
      openMobileNav: () => {
        if (isIncognito) return;
        setIsSidebarCollapsed(false);
      },
      setSidebarCollapsed: setIsSidebarCollapsed,
    }),
    [isMobile, isSidebarCollapsed, isIncognito, setIsSidebarCollapsed],
  );

  const overlayOpen = Boolean(overlays.currentOverlay);

  return (
    <div className={appShellRootClassName(isMobile)}>
      {!isIncognito && isMobile ? (
        <div
          role="presentation"
          aria-hidden={isSidebarCollapsed}
          onClick={isSidebarCollapsed ? undefined : closeMobileNav}
          className={cn(
            "fixed inset-0 z-[35] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:hidden",
            isSidebarCollapsed
              ? "pointer-events-none opacity-0"
              : "pointer-events-auto cursor-default opacity-100",
          )}
        >
          <div className="absolute inset-0 bg-[rgba(24,24,27,0.38)] backdrop-blur-[6px]" />
        </div>
      ) : null}

      {!isIncognito ? (
        <div
          className={cn(
            "app-sidebar-slot",
            !isMobile &&
              "relative z-40 h-full shrink-0 overflow-visible transition-[width] duration-300 ease-in-out",
            !isMobile &&
              (isSidebarCollapsed
                ? "w-0"
                : "w-[var(--app-sidebar-width)]"),
            overlayOpen && "pointer-events-none",
          )}
          onMouseEnter={!isMobile ? openSidebarPeek : undefined}
          onMouseLeave={!isMobile ? closeSidebarPeekSoon : undefined}
          onFocusCapture={!isMobile ? openSidebarPeek : undefined}
          onBlurCapture={
            !isMobile
              ? (event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  ) {
                    closeSidebarPeekSoon();
                  }
                }
              : undefined
          }
          inert={overlayOpen || undefined}
          aria-hidden={overlayOpen || undefined}
        >
          <div
            onMouseEnter={!isMobile ? cancelSidebarPeekClose : undefined}
            onMouseLeave={!isMobile ? closeSidebarPeekSoon : undefined}
            className={cn(
              "app-sidebar-panel",
              !isMobile &&
                "absolute inset-y-0 left-0 w-[var(--app-sidebar-width)] overflow-hidden transform-gpu transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              !isMobile &&
                isSidebarCollapsed &&
                "rounded-r-[14px] shadow-[10px_0_28px_rgba(28,25,23,0.10)] will-change-[transform,opacity] dark:shadow-[10px_0_32px_rgba(0,0,0,0.30)]",
              !isMobile &&
                isSidebarCollapsed &&
                !isSidebarPeekOpen &&
                "pointer-events-none -translate-x-full opacity-0",
              !isMobile &&
                (!isSidebarCollapsed || isSidebarPeekOpen) &&
                "translate-x-0 opacity-100",
            )}
          >
            <Sidebar
              id="app-primary-nav"
              handleNewChat={handleNewChat}
              isCollapsed={isMobile ? isSidebarCollapsed : false}
              setIsCollapsed={setSidebarCollapsedFromNav}
              isMobileLayout={isMobile}
              sidebarReady={sidebarHydrated}
              isPeekPreview={
                !isMobile && isSidebarCollapsed && isSidebarPeekOpen
              }
              onNavigate={handleSidebarNavigate}
              onUpgradeClick={onUpgradeClick}
              onSettingsClick={() => onSettingsClick("General")}
              onPersonalizationClick={onPersonalizationClick}
              onGiftClick={onGiftClick}
              activeView={computeActiveView(
                pathname,
                overlays.currentOverlay?.type ?? null,
                overlays.settingsTab,
              )}
              recentChats={startedRecentChats}
              activeChatId={sidebarActiveChatId}
              chatsLoading={chatsLoading}
              creatingChatPending={creatingChatPending}
              onSelectChat={onSelectChatFromSidebar}
              onDeleteChat={onDeleteChatFromSidebar}
              onRenameChat={handleRenameChat}
              onPinChat={handlePinChat}
              generatingChatIds={generatingChatIds}
              userDisplayName={
                auth.loading && !auth.user
                  ? null
                  : auth.user
                    ? sidebarDisplayNameOrNull({
                        fullName: auth.user.displayName,
                        preferredName: auth.user.preferredName,
                        email: auth.user.email,
                      })
                    : "Guest"
              }
              accountLoading={auth.loading && !auth.user}
              guestMode={!auth.loading && !auth.user?.id}
              userAvatarUrl={auth.user?.avatarUrl}
              userEmail={auth.user?.email ?? ""}
              onLogoutClick={() => void auth.logout()}
            />
            {!isMobile ? <SidebarResizeHandle /> : null}
          </div>
        </div>
      ) : null}

      {!isIncognito && !isMobile && isSidebarCollapsed ? (
        <button
          type="button"
          aria-label="Show sidebar"
          aria-controls="app-primary-nav"
          onMouseEnter={openSidebarPeek}
          onMouseLeave={closeSidebarPeekSoon}
          onFocus={openSidebarPeek}
          onBlur={closeSidebarPeekSoon}
          onClick={() => setSidebarCollapsedFromNav(false)}
          className={cn(
            "app-sidebar-peek-toggle fixed z-50 flex items-center justify-center border-0 bg-transparent text-[var(--cx-sidebar-fg,#52514e)] shadow-none transition-[background-color,color,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[var(--cx-sidebar-hover,rgba(0,0,0,0.05))] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:text-zinc-300 dark:hover:bg-white/[0.07] motion-reduce:transition-none",
            (overlayOpen || isSidebarPeekOpen) && "pointer-events-none opacity-0",
          )}
        >
          <SidebarToggleIcon className="size-5 shrink-0" />
        </button>
      ) : null}

      <main
        data-app-main-surface=""
        tabIndex={-1}
        data-sidebar-collapsed={
          isIncognito || (!isMobile && isSidebarCollapsed) ? "true" : undefined
        }
        data-incognito={isIncognito || undefined}
        className={cn(
          appMainShellClassName({
            isMobile,
            fullBleed: isIncognito || isMobileFullBleed,
          }),
          "outline-none",
          overlayOpen && "pointer-events-none",
        )}
        inert={overlayOpen || undefined}
        aria-hidden={overlayOpen || undefined}
      >
        <div
          data-component="agent-panel"
          data-layout="panel"
          className={appAgentPanelClassName({
            isMobile,
            fullBleed: isIncognito || isMobileFullBleed,
          })}
        >
          <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden items-stretch">
            <AppLayoutProvider value={layoutValue}>
              <SoftErrorBoundary name="main-panel">
                <AppPageSurface>{children}</AppPageSurface>
              </SoftErrorBoundary>
            </AppLayoutProvider>
          </div>
        </div>
      </main>

      <AppKeyboardController
        onNewChat={handleNewChat}
        onToggleSidebar={handleToggleSidebarShortcut}
        onOpenSettings={onSettingsClick}
        onNavigate={(path) => instantNavigate(path)}
        overlayOpen={overlayOpen}
        onCloseOverlay={overlays.closeOverlay}
      />

      <AppOverlayHost />
    </div>
  );
}

/**
 * Main app shell. Guests get the app as a live preview (middleware no longer
 * forces a login page); the chat session boots in API mode only once a
 * session exists — remount when the signed-in user changes.
 */
export function MainLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  // Stable key from identity hint so late auth.user.id does not remount
  // the chat tree and wipe sync-painted sidebar / in-RAM messages.
  const hintId =
    typeof window !== "undefined" ? readIdentityHintFromDocument()?.id : null;
  const sessionKey = auth.user?.id ?? hintId ?? "session";
  const apiEnabled = Boolean(auth.user?.id ?? hintId);

  return (
    <AppOverlaysProvider>
      <ChatSessionProvider key={sessionKey} apiEnabled={apiEnabled}>
        <MainLayoutShell>{children}</MainLayoutShell>
      </ChatSessionProvider>
    </AppOverlaysProvider>
  );
}

function computeActiveView(
  pathname: string | null,
  overlayType: string | null,
  settingsTab: SettingsTab | null,
): string {
  if (overlayType === "pricing") return "upgrade";
  if (overlayType === "gift") return "gift";
  if (overlayType === "settings" && settingsTab === "Clauxen Code") {
    return "clauxen-code";
  }
  if (!pathname) return "chat";
  if (pathname.startsWith("/my-clauxen")) return "my-clauxen";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/plugins")) return "plugins";
  if (pathname === "/new" || pathname === "/") return "chat";
  return "chat";
}

function getRouteChatIdForSidebar(pathname: string | null): string | null {
  if (!pathname) return null;
  const cMatch = pathname.match(/^\/c\/([^/?#]+)/);
  if (cMatch) return cMatch[1];
  return null;
}
