"use client";

import React, { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { SoftErrorBoundary } from "@/components/soft-error-boundary";
import { useAuth } from "@/hooks/use-auth";
import { sidebarDisplayNameOrNull } from "@/lib/profile-names";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import {
  appAgentPanelClassName,
  appMainShellClassName,
  appShellRootClassName,
} from "@/lib/app-shell-layout";
import { cn } from "@/lib/utils";
import type { SettingsTab } from "@/components/settings/constants";
import type { ApiProject } from "@/lib/api/projects";
import type { RecentChat } from "@/lib/types";
import { AppLayoutProvider } from "@/components/app-layout-context";
import {
  ChatSessionProvider,
  useChatSession,
} from "@/contexts/chat-session-context";
import { CLAUXEN_OPEN_CREATE_PROJECT_EVENT } from "@/components/composer-project-strip";
import { AppOverlayHost } from "@/components/app-overlay-host";
import { AppOverlaysProvider, useAppOverlays } from "@/hooks/use-app-overlays";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { readIdentityHintFromDocument } from "@/utils/identity-cookie";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { APP_ROUTES, isIncognitoPath } from "@/lib/app-routes";
import { AppPageSurface } from "@/components/app-page-surface";
import { Sidebar } from "@/components/sidebar";
import { SidebarToggleIcon } from "@/components/icons";

const MOBILE_FULL_BLEED_PREFIXES = [
  "/library",
  "/my-clauxen",
  "/project",
  "/projects",
  "/incognito",
] as const;

const APP_SHELL_PREFETCH_ROUTES = [
  APP_ROUTES.newChat,
  APP_ROUTES.library,
  APP_ROUTES.projects,
  APP_ROUTES.projectNew,
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
  const {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  } = useSidebarState();
  const [isSidebarPeekOpen, setIsSidebarPeekOpen] = React.useState(false);
  const sidebarPeekCloseTimerRef = React.useRef<number | null>(null);

  const cancelSidebarPeekClose = useCallback(() => {
    if (sidebarPeekCloseTimerRef.current === null) return;
    window.clearTimeout(sidebarPeekCloseTimerRef.current);
    sidebarPeekCloseTimerRef.current = null;
  }, []);

  const openSidebarPeek = useCallback(() => {
    if (isMobile || !isSidebarCollapsed) return;
    cancelSidebarPeekClose();
    setIsSidebarPeekOpen(true);
  }, [cancelSidebarPeekClose, isMobile, isSidebarCollapsed]);

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
      setIsSidebarCollapsed(collapsed);
    },
    [cancelSidebarPeekClose, setIsSidebarCollapsed],
  );

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

  React.useEffect(() => {
    if (isMobile || isIncognito) return;
    const handleSidebarShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "b"
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      setSidebarCollapsedFromNav(!isSidebarCollapsed);
    };
    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, [isIncognito, isMobile, isSidebarCollapsed, setSidebarCollapsedFromNav]);

  useDocumentTitle();

  React.useEffect(() => {
    if (auth.loading || !auth.user?.id) return;
    for (const route of APP_SHELL_PREFETCH_ROUTES) {
      router.prefetch(route);
    }
  }, [auth.loading, auth.user?.id, router]);

  // Client auth gate — middleware is primary; this catches JWT-less shells.
  React.useEffect(() => {
    if (auth.loading) return;
    if (auth.user?.id) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const redirectTo = `${pathname ?? "/"}${search}${hash}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [auth.loading, auth.user?.id, pathname, router]);

  // Boot: `/` → `/new` once identity is known (preserve overlay hash).
  React.useEffect(() => {
    if (pathname !== "/") return;
    if (!auth.user?.id) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    instantNavigate(`${APP_ROUTES.newChat}${hash}`, { replace: true });
  }, [pathname, auth.user?.id, instantNavigate]);

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
    handleMoveChatToProject,
    startNewChat,
  } = chat;

  const projects = useProjects(auth.isAuthenticated);
  const overlays = useAppOverlays();

  React.useEffect(() => {
    if (!auth.user?.id) return;
    router.prefetch(APP_ROUTES.newChat);
    for (const project of projects.projects.slice(0, 12)) {
      router.prefetch(APP_ROUTES.project(project.id));
    }
  }, [auth.user?.id, projects.projects, router]);

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

  const goToProjects = useCallback(() => {
    closeMobileNav();
  }, [closeMobileNav]);

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
      overlays.openSettings(tab);
      closeMobileNav();
    },
    [overlays, closeMobileNav],
  );

  const onPersonalizationClick = useCallback(() => {
    overlays.openSettings("Personalization");
    closeMobileNav();
  }, [overlays, closeMobileNav]);

  const onAppsExtensionsClick = useCallback(() => {
    overlays.openApps();
    closeMobileNav();
  }, [overlays, closeMobileNav]);

  const onGiftClick = useCallback(() => {
    overlays.openGift();
    closeMobileNav();
  }, [overlays, closeMobileNav]);

  const goToCreateProject = useCallback(() => {
    closeMobileNav();
  }, [closeMobileNav]);

  React.useEffect(() => {
    const onOpenCreate = () => {
      instantNavigate(APP_ROUTES.projectNew);
      closeMobileNav();
    };
    window.addEventListener(CLAUXEN_OPEN_CREATE_PROJECT_EVENT, onOpenCreate);
    return () => {
      window.removeEventListener(
        CLAUXEN_OPEN_CREATE_PROJECT_EVENT,
        onOpenCreate,
      );
    };
  }, [instantNavigate, closeMobileNav]);

  const openProjectDetail = useCallback(
    (_project: ApiProject) => {
      closeMobileNav();
    },
    [closeMobileNav],
  );

  const activeProjectId = React.useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/project\/([^/?#]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

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
      p === "/library" ||
      p === "/project" ||
      p === "/projects" ||
      (p.startsWith("/project/") &&
        !p.includes("/c/") &&
        !p.includes("/conversations/")) ||
      (p.startsWith("/projects") && !p.includes("/conversations/"))
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
            !isMobile &&
              "relative z-40 h-full shrink-0 overflow-visible transition-[width] duration-300 ease-in-out",
            !isMobile && (isSidebarCollapsed ? "w-0" : "w-[288px]"),
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
              !isMobile &&
                "absolute inset-y-0 left-0 w-[288px] overflow-hidden transform-gpu transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
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
              onAppsExtensionsClick={onAppsExtensionsClick}
              onGiftClick={onGiftClick}
              onProjectsClick={goToProjects}
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
              onMoveChatToProject={(chatId, projectId) => {
                void handleMoveChatToProject(chatId, projectId);
                if (activeChatId === chatId) {
                  if (projectId) {
                    instantNavigate(APP_ROUTES.projectChat(projectId, chatId));
                  } else {
                    instantNavigate(APP_ROUTES.chat(chatId));
                  }
                }
                closeMobileNav();
              }}
              generatingChatIds={generatingChatIds}
              projects={projects.projects}
              pinnedProjects={projects.pinnedProjects}
              projectsLoading={projects.loading}
              activeProjectId={activeProjectId}
              onNewProjectClick={goToCreateProject}
              onSelectProject={openProjectDetail}
              onPinProject={projects.pinProject}
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
              userAvatarUrl={auth.user?.avatarUrl}
              userEmail={auth.user?.email ?? ""}
              onLogoutClick={() => void auth.logout()}
            />
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
            "app-sidebar-peek-toggle fixed left-[10px] top-[14px] z-50 flex size-8 items-center justify-center rounded-[9px] border-0 bg-transparent text-[#52514e] shadow-none transition-[background-color,color,opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/[0.05] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:text-zinc-300 dark:hover:bg-white/[0.07] motion-reduce:transition-none",
            overlayOpen && "pointer-events-none opacity-0",
          )}
        >
          <SidebarToggleIcon className="size-[18px] shrink-0" />
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

      <AppOverlayHost />
    </div>
  );
}

/**
 * Main app shell. Middleware already requires auth for these routes, so the
 * chat session always boots in API mode — remount when the signed-in user changes.
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
  if (overlayType === "apps") return "apps";
  if (overlayType === "settings" && settingsTab === "Clauxen Code") {
    return "clauxen-code";
  }
  if (!pathname) return "chat";
  if (pathname.startsWith("/my-clauxen")) return "my-clauxen";
  if (pathname.startsWith("/project") || pathname.startsWith("/projects")) {
    return "projects";
  }
  if (pathname.startsWith("/library")) return "library";
  if (pathname === "/new" || pathname === "/") return "chat";
  return "chat";
}

function getRouteChatIdForSidebar(pathname: string | null): string | null {
  if (!pathname) return null;
  const cMatch = pathname.match(/^\/c\/([^/?#]+)/);
  if (cMatch) return cMatch[1];
  const projectChatMatch = pathname.match(/^\/project\/[^/?#]+\/c\/([^/?#]+)/);
  if (projectChatMatch) return projectChatMatch[1];
  const pMatch = pathname.match(/\/conversations\/([^/?#]+)/);
  if (pMatch) return pMatch[1];
  return null;
}
