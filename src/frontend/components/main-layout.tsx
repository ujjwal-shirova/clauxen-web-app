"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { SoftErrorBoundary } from "@/frontend/components/soft-error-boundary";
import { useAuth } from "@/frontend/hooks/use-auth";
import { sidebarDisplayName } from "@/lib/profile-names";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useSidebarState } from "@/frontend/hooks/use-sidebar-state";
import { useToast } from "@/frontend/hooks/use-toast";
import {
  appAgentPanelClassName,
  appMainShellClassName,
  appShellRootClassName,
} from "@/frontend/lib/app-shell-layout";
import { cn } from "@/frontend/lib/utils";
import type { SettingsTab } from "@/frontend/components/settings/constants";
import type { ApiProject } from "@/frontend/lib/api/projects";
import type { RecentChat } from "@/frontend/lib/types";
import { AppLayoutProvider } from "@/frontend/components/app-layout-context";
import {
  ChatSessionProvider,
  useChatSession,
} from "@/frontend/contexts/chat-session-context";
import { CreateProjectDialog } from "@/frontend/components/create-project-dialog";
import { AppOverlayHost } from "@/frontend/components/app-overlay-host";
import {
  AppOverlaysProvider,
  useAppOverlays,
} from "@/frontend/hooks/use-app-overlays";
import { useInstantNavigate } from "@/frontend/hooks/use-instant-navigate";
import { useDocumentTitle } from "@/frontend/hooks/use-document-title";
import { APP_ROUTES } from "@/frontend/lib/app-routes";
import { MainShellSkeleton } from "@/frontend/components/chat-route-skeleton";

const Sidebar = dynamic(
  () =>
    import("@/frontend/components/sidebar").then((mod) => ({
      default: mod.Sidebar,
    })),
  {
    ssr: false,
    loading: () => (
      <aside
        className="hidden h-full w-[260px] shrink-0 border-r border-border/40 bg-background md:block"
        aria-hidden
      />
    ),
  },
);

const MOBILE_FULL_BLEED_PREFIXES = [
  "/library",
  "/customize",
  "/projects",
] as const;

function shouldMobileFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;
  return MOBILE_FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const instantNavigate = useInstantNavigate();
  const auth = useAuth();
  const { toast } = useToast();
  const {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  } = useSidebarState();

  useDocumentTitle();

  // Client auth gate — middleware is primary; this catches JWT-less shells.
  React.useEffect(() => {
    if (auth.loading) return;
    if (auth.user?.id) return;
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const redirectTo = `${pathname ?? "/"}${search}${hash}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [auth.loading, auth.user?.id, pathname, router]);

  // Boot: `/` → `/new` once identity is known (preserve overlay hash).
  React.useEffect(() => {
    if (pathname !== "/") return;
    if (!auth.user?.id) return;
    const hash =
      typeof window !== "undefined" ? window.location.hash : "";
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

  const goToLibrary = useCallback(() => {
    instantNavigate(APP_ROUTES.library);
    closeMobileNav();
  }, [instantNavigate, closeMobileNav]);

  const goToProjects = useCallback(() => {
    instantNavigate(APP_ROUTES.projects);
    closeMobileNav();
  }, [instantNavigate, closeMobileNav]);

  const goToCustomize = useCallback(() => {
    instantNavigate(APP_ROUTES.customize);
    closeMobileNav();
  }, [instantNavigate, closeMobileNav]);

  const goToMyClauxen = useCallback(() => {
    instantNavigate(APP_ROUTES.customize);
    closeMobileNav();
  }, [instantNavigate, closeMobileNav]);

  const onSelectChatFromSidebar = useCallback(
    (chatEntry: RecentChat) => {
      handleSelectChat(chatEntry.id);
      const target = chatEntry.projectId
        ? APP_ROUTES.projectConversation(chatEntry.projectId, chatEntry.id)
        : APP_ROUTES.chat(chatEntry.id);
      instantNavigate(target);
      closeMobileNav();
    },
    [handleSelectChat, instantNavigate, closeMobileNav],
  );

  const onDeleteChatFromSidebar = useCallback(
    async (chatId: string) => {
      const wasActive =
        activeChatId === chatId ||
        getRouteChatIdForSidebar(pathname) === chatId;
      await handleDeleteChat(chatId);
      if (wasActive) {
        instantNavigate(APP_ROUTES.newChat, { replace: true });
      }
      closeMobileNav();
    },
    [
      activeChatId,
      closeMobileNav,
      handleDeleteChat,
      instantNavigate,
      pathname,
    ],
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

  const [createProjectOpen, setCreateProjectOpen] = React.useState(false);
  const [isCreatingProject, setIsCreatingProject] = React.useState(false);

  const openProjectDetail = useCallback(
    (project: ApiProject) => {
      setCreateProjectOpen(false);
      instantNavigate(APP_ROUTES.project(project.id));
      closeMobileNav();
    },
    [instantNavigate, closeMobileNav],
  );

  const activeProjectId = React.useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/projects\/([^/?#]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const notifyComingSoon = useCallback(
    (feature: string) => {
      toast({
        title: feature,
        description: "This surface is coming soon.",
      });
      closeMobileNav();
    },
    [toast, closeMobileNav],
  );

  const isMobileFullBleed = isMobile && shouldMobileFullBleed(pathname);

  const sidebarActiveChatId = React.useMemo(() => {
    const routeId = getRouteChatIdForSidebar(pathname);
    if (routeId) return routeId;

    const p = pathname || "";
    if (
      p === "/" ||
      p === "/new" ||
      p === "/library" ||
      p === "/projects" ||
      p.startsWith("/customize") ||
      (p.startsWith("/projects") && !p.includes("/conversations/"))
    ) {
      return null;
    }
    return activeChatId;
  }, [pathname, activeChatId]);

  const layoutValue = React.useMemo(
    () => ({
      isMobile,
      isSidebarCollapsed,
      openMobileNav: () => setIsSidebarCollapsed(false),
      setSidebarCollapsed: setIsSidebarCollapsed,
    }),
    [isMobile, isSidebarCollapsed, setIsSidebarCollapsed],
  );

  return (
    <div className={appShellRootClassName(isMobile)}>
      {isMobile ? (
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
        onMyClauxenClick={goToMyClauxen}
        onScheduledTasksClick={() => notifyComingSoon("Scheduled Task")}
        onClauxenCodeClick={() => onSettingsClick("Clauxen Code")}
        onClauxenWorkClick={() => notifyComingSoon("Clauxen Work")}
        onClauxenClawClick={() => notifyComingSoon("Clauxen Claw")}
        activeView={computeActiveView(
          pathname,
          overlays.currentOverlay?.type ?? null,
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
        projectsLoading={projects.loading}
        activeProjectId={activeProjectId}
        onNewProjectClick={() => setCreateProjectOpen(true)}
        onSelectProject={openProjectDetail}
        userDisplayName={sidebarDisplayName({
          fullName: auth.user?.displayName,
          preferredName: auth.user?.preferredName,
          email: auth.user?.email,
          authenticated: Boolean(auth.user?.id) || auth.loading,
        })}
        userAvatarUrl={auth.user?.avatarUrl}
        userEmail={auth.user?.email ?? ""}
        onLogoutClick={() => void auth.logout()}
      />

      <main
        data-sidebar-collapsed={
          !isMobile && isSidebarCollapsed ? "true" : undefined
        }
        className={appMainShellClassName({
          isMobile,
          fullBleed: isMobileFullBleed,
        })}
      >
        <div
          data-component="agent-panel"
          data-layout="panel"
          className={appAgentPanelClassName({
            isMobile,
            fullBleed: isMobileFullBleed,
          })}
        >
          <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden items-stretch">
            <AppLayoutProvider value={layoutValue}>
              <SoftErrorBoundary name="main-panel">{children}</SoftErrorBoundary>
            </AppLayoutProvider>
          </div>
        </div>
      </main>

      {createProjectOpen ? (
        <CreateProjectDialog
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
          isSubmitting={isCreatingProject}
          onSubmit={async ({ name, description }) => {
            setIsCreatingProject(true);
            try {
              const project = await projects.createProject({
                name,
                description: description || undefined,
              });
              if (project) {
                openProjectDetail(project);
              } else {
                toast({
                  title: "Could not create project",
                  description: "Enter a project name and try again.",
                  variant: "destructive",
                });
              }
            } catch {
              toast({
                title: "Could not create project",
                description: "Something went wrong. Please try again.",
                variant: "destructive",
              });
            } finally {
              setIsCreatingProject(false);
            }
          }}
        />
      ) : null}

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

  // Identity hint seeds user instantly; shimmer only until we have an id.
  if (!auth.user?.id) {
    return <MainShellSkeleton />;
  }

  return (
    <AppOverlaysProvider>
      <ChatSessionProvider key={auth.user.id} apiEnabled>
        <MainLayoutShell>{children}</MainLayoutShell>
      </ChatSessionProvider>
    </AppOverlaysProvider>
  );
}

function computeActiveView(
  pathname: string | null,
  overlayType: string | null,
): string {
  if (overlayType === "settings") return "settings";
  if (overlayType === "pricing") return "upgrade";
  if (overlayType === "gift") return "gift";
  if (overlayType === "apps") return "apps";
  if (!pathname) return "chat";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/customize")) return "customize";
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
