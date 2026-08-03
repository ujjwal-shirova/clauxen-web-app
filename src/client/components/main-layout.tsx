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
import { APP_ROUTES, isIncognitoPath, isNewChatPath } from "@/lib/app-routes";
import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";

const MOBILE_FULL_BLEED_PREFIXES = [
  "/library",
  "/scheduled",
  "/my-clauxen",
  "/project",
  "/projects",
  "/incognito",
] as const;

function shouldMobileFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;
  return MOBILE_FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isChatSurface(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (isNewChatPath(pathname) || isIncognitoPath(pathname)) return true;
  return (
    /^\/c\/[^/]+/.test(pathname) || /\/conversations\/[^/]+/.test(pathname)
  );
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = useAppPathname();
  const nextPathname = usePathname() || "";
  const instantNavigate = useInstantNavigate();
  const auth = useAuth();
  const {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  } = useSidebarState();

  useDocumentTitle();

  // Soft-nav updates the URL before Next swaps RSC children. When the live
  // path is a chat surface (including /new, /c/*, /incognito), paint ChatView
  // directly so new chats, thread switches, and new turns feel instant with no cuts.
  const paintOptimisticChat = isChatSurface(pathname);

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
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    startNewChat,
  } = chat;

  const projects = useProjects(auth.isAuthenticated);
  const overlays = useAppOverlays();

  const closeMobileNav = useCallback(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [isMobile, setIsSidebarCollapsed]);

  React.useEffect(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [pathname, isMobile, setIsSidebarCollapsed]);

  const handleNewChat = useCallback(() => {
    startNewChat();
    closeMobileNav();
    if (overlays.currentOverlay) {
      overlays.closeOverlay();
      return;
    }
    instantNavigate(APP_ROUTES.newChat, { replace: true });
  }, [startNewChat, closeMobileNav, overlays, instantNavigate]);

  /** Side-effects only — route changes come from AppHref / plain href. */
  const goToLibrary = useCallback(() => {
    closeMobileNav();
  }, [closeMobileNav]);

  const goToScheduledTasks = useCallback(() => {
    closeMobileNav();
  }, [closeMobileNav]);

  const goToProjects = useCallback(() => {
    closeMobileNav();
  }, [closeMobileNav]);

  const goToCustomize = useCallback(() => {
    overlays.openSettings("Connectors");
    closeMobileNav();
  }, [overlays, closeMobileNav]);

  const onSelectChatFromSidebar = useCallback(
    (chatEntry: RecentChat) => {
      handleSelectChat(chatEntry.id);
      closeMobileNav();
    },
    [handleSelectChat, closeMobileNav],
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
      instantNavigate(APP_ROUTES.projects);
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
  const isIncognito = isIncognitoPath(pathname);

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
      p === "/scheduled" ||
      p.startsWith("/scheduled/") ||
      p === "/project" ||
      p === "/projects" ||
      (p.startsWith("/project/") && !p.includes("/conversations/")) ||
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
            "fixed inset-0 z-[35] bg-[rgba(24,24,27,0.38)] backdrop-blur-[6px] transition-[opacity,backdrop-filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:hidden",
            isSidebarCollapsed
              ? "pointer-events-none opacity-0 backdrop-blur-none"
              : "pointer-events-auto cursor-default opacity-100",
          )}
        />
      ) : null}

      {!isIncognito ? (
        <div
          className={cn(overlayOpen && "pointer-events-none")}
          inert={overlayOpen || undefined}
          aria-hidden={overlayOpen || undefined}
        >
        <Sidebar
          id="app-primary-nav"
          handleNewChat={handleNewChat}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileLayout={isMobile}
          sidebarReady={sidebarHydrated}
          onNavigate={closeMobileNav}
          onUpgradeClick={onUpgradeClick}
          onSettingsClick={() => onSettingsClick("General")}
          onPersonalizationClick={onPersonalizationClick}
          onAppsExtensionsClick={onAppsExtensionsClick}
          onGiftClick={onGiftClick}
          onProjectsClick={goToProjects}
          onLibraryClick={goToLibrary}
          onCustomizeClick={goToCustomize}
          onScheduledTasksClick={goToScheduledTasks}
          onClauxenCodeClick={() => onSettingsClick("Clauxen Code")}
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
                {paintOptimisticChat ? <ChatView /> : children}
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
  if (overlayType === "settings" && settingsTab === "Connectors") {
    return "connectors";
  }
  if (overlayType === "settings" && settingsTab === "Clauxen Code") {
    return "clauxen-code";
  }
  if (!pathname) return "chat";
  if (pathname.startsWith("/my-clauxen")) return "my-clauxen";
  if (pathname.startsWith("/project") || pathname.startsWith("/projects")) {
    return "projects";
  }
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/scheduled")) return "scheduled-tasks";
  if (pathname === "/new" || pathname === "/") return "chat";
  return "chat";
}

function getRouteChatIdForSidebar(pathname: string | null): string | null {
  if (!pathname) return null;
  const cMatch = pathname.match(/^\/c\/([^/?#]+)/);
  if (cMatch) return cMatch[1];
  const pMatch = pathname.match(/\/conversations\/([^/?#]+)/);
  if (pMatch) return pMatch[1];
  return null;
}
