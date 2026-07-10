"use client";

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { SettingsModal } from "@/frontend/components/settings-page";
import { SettingsErrorBoundary } from "@/frontend/components/settings/settings-error-boundary";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/frontend/components/sidebar";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useChat } from "@/frontend/hooks/use-chat";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useSidebarState } from "@/frontend/hooks/use-sidebar-state";
import { useAppOverlays } from "@/frontend/hooks/use-app-overlays";
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

const UpgradeView = dynamic(
  () =>
    import("@/frontend/components/upgrade-view").then((m) => m.UpgradeView),
  { ssr: false },
);
const AppsExtensionsView = dynamic(
  () =>
    import("@/frontend/components/apps-extensions-view").then(
      (m) => m.AppsExtensionsView,
    ),
  { ssr: false },
);
const GiftView = dynamic(
  () => import("@/frontend/components/gift-view").then((m) => m.GiftView),
  { ssr: false },
);
const CreateProjectDialog = dynamic(
  () =>
    import("@/frontend/components/create-project-dialog").then(
      (m) => m.CreateProjectDialog,
    ),
  { ssr: false },
);

const MOBILE_FULL_BLEED_PREFIXES = ["/library", "/customize", "/projects"] as const;

function shouldMobileFullBleed(pathname: string | null): boolean {
  if (!pathname) return false;
  return MOBILE_FULL_BLEED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const [settingsMountKey, setSettingsMountKey] = useState(0);
  const { toast } = useToast();
  const {
    isMobile,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarHydrated,
  } = useSidebarState();

  const chat = useChat({ apiEnabled: false });
  const {
    startedRecentChats,
    activeChatId,
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
    router.push("/", { scroll: false });
  }, [startNewChat, closeMobileNav, router]);

  const goToLibrary = useCallback(() => {
    router.push("/library");
    closeMobileNav();
  }, [router, closeMobileNav]);

  const goToProjects = useCallback(() => {
    router.push("/projects");
    closeMobileNav();
  }, [router, closeMobileNav]);

  const goToCustomize = useCallback(() => {
    router.push("/customize");
    closeMobileNav();
  }, [router, closeMobileNav]);

  const goToHistory = useCallback(() => {
    if (!activeChatId) {
      router.push("/");
      closeMobileNav();
      return;
    }
    const chat = startedRecentChats.find((c) => c.id === activeChatId);
    const target = chat?.projectId
      ? `/projects/${chat.projectId}/conversations/${activeChatId}`
      : `/c/${activeChatId}`;
    router.push(target);
    closeMobileNav();
  }, [router, activeChatId, closeMobileNav, startedRecentChats]);

  const onSelectChatFromSidebar = useCallback(
    (chat: RecentChat) => {
      handleSelectChat(chat.id);
      const target = chat.projectId
        ? `/projects/${chat.projectId}/conversations/${chat.id}`
        : `/c/${chat.id}`;
      router.push(target);
      closeMobileNav();
    },
    [handleSelectChat, router, closeMobileNav],
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
      router.push(`/projects/${project.id}`);
    },
    [router],
  );

  const isMobileFullBleed = isMobile && shouldMobileFullBleed(pathname);

  const sidebarActiveChatId = React.useMemo(() => {
    const routeId = getRouteChatIdForSidebar(pathname);
    if (routeId) return routeId;

    const p = pathname || "";
    if (
      p === "/" ||
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
        onHistoryClick={goToHistory}
        activeView={computeActiveViewFromPath(pathname)}
        recentChats={startedRecentChats}
        activeChatId={sidebarActiveChatId}
        onSelectChat={onSelectChatFromSidebar}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        userDisplayName={
          auth.user?.displayName?.trim() ||
          auth.user?.email?.split("@")[0] ||
          "Guest"
        }
        userEmail={auth.user?.email ?? ""}
        onLogoutClick={() => void auth.logout()}
      />

      <main
        data-sidebar-collapsed={!isMobile && isSidebarCollapsed ? "true" : undefined}
        className={appMainShellClassName({ isMobile, fullBleed: isMobileFullBleed })}
      >
        <div
          data-component="agent-panel"
          data-layout="panel"
          className={appAgentPanelClassName({ isMobile, fullBleed: isMobileFullBleed })}
        >
          <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden items-stretch">
            <AppLayoutProvider value={layoutValue}>{children}</AppLayoutProvider>
          </div>
        </div>
      </main>

      {overlays.isOpen.pricing && <UpgradeView onClose={overlays.closeOverlay} />}

      {overlays.isOpen.apps && (
        <AppsExtensionsView
          onClose={overlays.closeOverlay}
          onUpgradeClick={() => {
            overlays.closeOverlay();
            setTimeout(() => overlays.openPricing(), 0);
          }}
        />
      )}

      {overlays.isOpen.gift && <GiftView onClose={overlays.closeOverlay} />}

      {overlays.isOpen.settings ? (
        <SettingsErrorBoundary
          onClose={overlays.closeOverlay}
          onReload={() => setSettingsMountKey((key) => key + 1)}
        >
          <SettingsModal
            key={settingsMountKey}
            open
            onClose={overlays.closeOverlay}
            initialTab={(overlays.settingsTab as SettingsTab) || "General"}
            onTabChange={(tab) => overlays.openSettings(tab)}
            onGoToCustomize={(tab) => {
              overlays.closeOverlay();
              router.push(
                tab === "connectors" ? "/customize/connectors" : "/customize",
              );
            }}
            onUpgradeClick={() => {
              overlays.closeOverlay();
              setTimeout(() => overlays.openPricing(), 0);
            }}
            user={auth.user}
            onLogout={() => void auth.logout()}
          />
        </SettingsErrorBoundary>
      ) : null}

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
    </div>
  );
}

function computeActiveViewFromPath(pathname: string | null): string {
  if (!pathname) return "chat";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/customize")) return "customize";
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
