"use client";

import React, { useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/frontend/components/sidebar";
import { SettingsModal } from "@/frontend/components/settings-page";
import { ProjectsShellProvider } from "@/frontend/components/projects/projects-shell-context";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useChat } from "@/frontend/hooks/use-chat";
import { useSidebarState } from "@/frontend/hooks/use-sidebar-state";
import {
  appAgentPanelClassName,
  appMainShellClassName,
  appShellRootClassName,
} from "@/frontend/lib/app-shell-layout";
import { cn } from "@/frontend/lib/utils";
import type { SettingsTab } from "@/frontend/components/settings/constants";

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const auth = useAuth();
  const { isMobile, isSidebarCollapsed, setIsSidebarCollapsed } =
    useSidebarState();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<SettingsTab>("General");

  const {
    startedRecentChats,
    activeChatId,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    startNewChat,
    recentChats,
  } = useChat({ apiEnabled: auth.isAuthenticated });

  useLayoutEffect(() => {
    if (!isMobile || isSidebarCollapsed) {
      document.documentElement.style.removeProperty("overflow");
      return;
    }
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [isMobile, isSidebarCollapsed]);

  const closeMobileNav = () => {
    if (isMobile) setIsSidebarCollapsed(true);
  };

  const openMobileNav = () => {
    setIsSidebarCollapsed(false);
  };

  const navigateToChat = (chatId: string) => {
    const chat =
      recentChats.find((entry) => entry.id === chatId) ??
      startedRecentChats.find((entry) => entry.id === chatId);
    handleSelectChat(chatId);
    if (chat?.projectId) {
      router.push(`/projects/${chat.projectId}/conversations/${chatId}`);
    } else {
      router.push("/");
    }
    closeMobileNav();
  };

  const shellValue = useMemo(
    () => ({
      isMobile,
      isSidebarCollapsed,
      openMobileNav,
    }),
    [isMobile, isSidebarCollapsed],
  );

  return (
    <ProjectsShellProvider value={shellValue}>
      <div className={appShellRootClassName(isMobile)}>
        {isMobile ? (
          <div
            role="presentation"
            aria-hidden={isSidebarCollapsed}
            onClick={isSidebarCollapsed ? undefined : closeMobileNav}
            className={cn(
              "fixed inset-0 z-[35] bg-[rgba(24,24,27,0.38)] backdrop-blur-[6px] transition-opacity duration-300 lg:hidden",
              isSidebarCollapsed
                ? "pointer-events-none opacity-0"
                : "pointer-events-auto opacity-100",
            )}
          />
        ) : null}

        <Sidebar
          id="projects-primary-nav"
          handleNewChat={() => {
            startNewChat();
            router.push("/");
            closeMobileNav();
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileLayout={isMobile}
          onNavigate={closeMobileNav}
          onUpgradeClick={closeMobileNav}
          onSettingsClick={() => {
            setSettingsInitialTab("General");
            setShowSettings(true);
            closeMobileNav();
          }}
          onPersonalizationClick={() => {
            setSettingsInitialTab("Personalization");
            setShowSettings(true);
            closeMobileNav();
          }}
          onAppsExtensionsClick={closeMobileNav}
          onGiftClick={closeMobileNav}
          onProjectsClick={() => {
            router.push("/projects");
            closeMobileNav();
          }}
          onLibraryClick={() => {
            router.push("/");
            closeMobileNav();
          }}
          onCustomizeClick={() => {
            router.push("/");
            closeMobileNav();
          }}
          onHistoryClick={() => {
            router.push("/");
            closeMobileNav();
          }}
          activeView="projects"
          recentChats={startedRecentChats}
          activeChatId={activeChatId}
          onSelectChat={navigateToChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onPinChat={handlePinChat}
          userDisplayName={auth.user?.displayName ?? auth.user?.email ?? "Guest"}
          userEmail={auth.user?.email ?? ""}
          onLogoutClick={() => void auth.logout()}
        />

        <main
          data-sidebar-collapsed={
            !isMobile && isSidebarCollapsed ? "true" : undefined
          }
          className={appMainShellClassName({
            isMobile,
            fullBleed: isMobile,
          })}
        >
          {isMobile ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          ) : (
            <div
              className={appAgentPanelClassName({
                isMobile: false,
                fullBleed: false,
              })}
            >
              {children}
            </div>
          )}
        </main>

        <SettingsModal
          key={settingsInitialTab}
          open={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsInitialTab}
          onGoToCustomize={() => {
            setShowSettings(false);
            router.push("/");
          }}
          user={auth.user}
          onLogout={() => void auth.logout()}
        />
      </div>
    </ProjectsShellProvider>
  );
}
