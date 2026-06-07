"use client";

import React, { useState, useEffect, useLayoutEffect } from "react";
import { Menu } from "lucide-react";
import { useChat } from "@/frontend/hooks/use-chat";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import { Sidebar } from "@/frontend/components/sidebar";
import { ChatArea } from "@/frontend/components/chat-area";
import { UpgradeView } from "@/frontend/components/upgrade-view";
import { SettingsPage } from "@/frontend/components/settings-page";
import { AppsExtensionsView } from "@/frontend/components/apps-extensions-view";
import { GiftView } from "@/frontend/components/gift-view";
import { CustomizePage } from "@/frontend/components/customize-page";
import { ProjectsView } from "@/frontend/components/projects-view";
import { ProjectDetailView } from "@/frontend/components/project-detail-view";
import { CreateProjectDialog } from "@/frontend/components/create-project-dialog";
import { ArtifactsView } from "@/frontend/components/artifacts-view";
import { LibraryView } from "@/frontend/components/library-view";
import { ImagesView } from "@/frontend/components/images-view";
import { ClauxenClawView } from "@/frontend/components/clauxen-claw-view";
import { DeepResearchView } from "@/frontend/components/deep-research-view";
import { cn } from "@/frontend/lib/utils";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import type { SettingsTab } from "@/frontend/components/settings/constants";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { useToast } from "@/frontend/hooks/use-toast";

export default function Home() {
  const auth = useAuth();
  const { toast } = useToast();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [detailProject, setDetailProject] = useState<ApiProject | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const chat = useChat({
    apiEnabled: false,
    projectId: activeProjectId,
    thinkingEnabled,
  });
  const projects = useProjects(auth.isAuthenticated);

  const {
    messages,
    recentChats,
    activeChat,
    isGenerating,
    handleSendMessage,
    stopGeneration,
    startNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    editMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
    activeChatId,
  } = chat;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [activeView, setActiveView] = useState<
    | "chat"
    | "settings"
    | "customize"
    | "projects"
    | "project-detail"
    | "artifacts"
    | "library"
    | "images"
    | "claw"
    | "deep-research"
  >("chat");
  const [showUpgradeView, setShowUpgradeView] = useState(false);
  const [showAppsView, setShowAppsView] = useState(false);
  const [showGiftView, setShowGiftView] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<
    "skills" | "connectors" | null
  >(null);
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<SettingsTab>("General");
  const [chatRenderKey, setChatRenderKey] = useState(0);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const isMobile = useIsMobile();

  const activeProject =
    detailProject ??
    (activeProjectId != null
      ? projects.projects.find((p) => p.id === activeProjectId) ?? null
      : null);

  const closeMobileNav = React.useCallback(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [isMobile]);

  useEffect(() => {
    if (activeView === "customize") {
      setIsSidebarCollapsed(true);
    }
  }, [activeView]);

  useLayoutEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const syncSidebarToViewport = () => {
      setIsSidebarCollapsed(mql.matches);
    };
    syncSidebarToViewport();
    mql.addEventListener("change", syncSidebarToViewport);
    return () => mql.removeEventListener("change", syncSidebarToViewport);
  }, []);

  useEffect(() => {
    if (!isMobile || isSidebarCollapsed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSidebarCollapsed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, isSidebarCollapsed]);

  useEffect(() => {
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

  const handleNewChat = () => {
    startNewChat();
    setActiveView("chat");
    setIsSidebarCollapsed(isMobile);
    setChatRenderKey((current) => current + 1);
  };

  const handleGoToView = (
    view:
      | "chat"
      | "settings"
      | "customize"
      | "projects"
      | "project-detail"
      | "artifacts"
      | "library"
      | "images"
      | "claw"
      | "deep-research",
    tab?: "skills" | "connectors",
  ) => {
    setCustomizeTab(tab || null);
    setActiveView(view);

    if (view === "customize" || isMobile) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };

  const openProjectDetail = React.useCallback(
    (project: ApiProject) => {
      setDetailProject(project);
      setActiveProjectId(project.id);
      setCreateProjectOpen(false);
      handleGoToView("project-detail");
    },
    [handleGoToView],
  );

  const isMobileFullBleedView =
    isMobile &&
    (activeView === "customize" ||
      activeView === "settings" ||
      activeView === "projects" ||
      activeView === "project-detail" ||
      activeView === "artifacts" ||
      activeView === "library" ||
      activeView === "images" ||
      activeView === "claw" ||
      activeView === "deep-research");

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] font-sans text-zinc-800">
      {isMobile ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          aria-hidden={isSidebarCollapsed}
          tabIndex={isSidebarCollapsed ? -1 : 0}
          onClick={closeMobileNav}
          className={cn(
            "fixed inset-0 z-[35] bg-[#1a1712]/30 backdrop-blur-[4px] transition-[opacity,backdrop-filter] duration-300 ease-out lg:hidden",
            isSidebarCollapsed
              ? "pointer-events-none opacity-0"
              : "pointer-events-auto opacity-100",
          )}
        />
      ) : null}

      <Sidebar
        id="app-primary-nav"
        handleNewChat={handleNewChat}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileLayout={isMobile}
        onNavigate={closeMobileNav}
        onUpgradeClick={() => {
          setShowUpgradeView(true);
          closeMobileNav();
        }}
        onSettingsClick={() => {
          setSettingsInitialTab("General");
          handleGoToView("settings");
        }}
        onPersonalizationClick={() => {
          setSettingsInitialTab("Personalization");
          handleGoToView("settings");
        }}
        onAppsExtensionsClick={() => {
          setShowAppsView(true);
          closeMobileNav();
        }}
        onGiftClick={() => {
          setShowGiftView(true);
          closeMobileNav();
        }}
        onProjectsClick={() => {
          setActiveProjectId(null);
          handleGoToView("projects");
        }}
        onArtifactsClick={() => handleGoToView("artifacts")}
        onLibraryClick={() => handleGoToView("library")}
        onCustomizeClick={() => handleGoToView("customize")}
        onImagesClick={() => handleGoToView("images")}
        onDeepResearchClick={() => handleGoToView("deep-research")}
        onClawClick={() => handleGoToView("claw")}
        onHistoryClick={() => handleGoToView("chat")}
        activeView={
          activeView === "project-detail" ? "projects" : activeView
        }
        recentChats={recentChats}
        activeChatId={activeChatId}
        onSelectChat={(chatId) => {
          handleSelectChat(chatId);
          closeMobileNav();
        }}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        userDisplayName={auth.user?.displayName ?? auth.user?.email ?? "Guest"}
        userEmail={auth.user?.email ?? ""}
        onLogoutClick={() => void auth.logout()}
      />

      <main
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)] transition-[padding] duration-300 ease-in-out",
          isMobileFullBleedView
            ? "p-0"
            : "pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:pt-2 sm:pr-2 sm:pb-2",
          isMobile && !isMobileFullBleedView && "pl-[max(0.5rem,env(safe-area-inset-left))]",
          !isMobile &&
            (isSidebarCollapsed
              ? "pl-[44px] sm:pl-[46px]"
              : "pl-[44px] lg:pl-[264px]"),
          isMobile && !isSidebarCollapsed && "pointer-events-none",
        )}
      >
        {isMobile && isSidebarCollapsed && !isMobileFullBleedView && (
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={false}
            aria-controls="app-primary-nav"
            onClick={() => setIsSidebarCollapsed(false)}
            className="pointer-events-auto absolute left-[max(0.625rem,env(safe-area-inset-left))] top-[max(0.625rem,env(safe-area-inset-top))] z-[45] flex h-11 min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-zinc-200 bg-white/95 text-zinc-700 shadow-sm backdrop-blur-md transition-colors hover:bg-zinc-100 active:scale-[0.98] lg:hidden"
          >
            <Menu className="icon-xl" />
          </button>
        )}

        <div
          className={cn(
            "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] [transform:translateZ(0)]",
            isMobileFullBleedView
              ? "min-h-[100dvh] rounded-none border-0 shadow-none"
              : "rounded-[16px] border border-zinc-200/80 shadow-[0_1px_3px_rgba(24,24,27,0.04),0_8px_24px_-8px_rgba(24,24,27,0.06)] sm:rounded-[18px]",
            isMobile &&
              isSidebarCollapsed &&
              !isMobileFullBleedView &&
              "pl-[max(3rem,calc(2.75rem+env(safe-area-inset-left)))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.375rem,env(safe-area-inset-top))]",
          )}
        >
          <div
            className={cn(
              "flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden",
              isMobileFullBleedView ? "items-stretch" : "items-center",
            )}
          >
            {activeView === "chat" && (
              <ChatArea
                key={chatRenderKey}
                messages={messages}
                onSendMessage={handleSendMessage}
                onStopGeneration={stopGeneration}
                isGenerating={isGenerating}
                onUpgradeClick={() => setShowUpgradeView(true)}
                editMessageWithBranch={editMessageWithBranch}
                retryAssistantWithBranch={retryAssistantWithBranch}
                switchMessageBranch={switchMessageBranch}
                activeChatId={activeChatId}
                activeChatTitle={activeChat?.name ?? "New Chat"}
                isActiveChatTitleStreaming={!!activeChat?.isTitleStreaming}
                onDeleteChat={handleDeleteChat}
                onOpenSettings={() => {
                  setSettingsInitialTab("General");
                  handleGoToView("settings");
                }}
                thinkingEnabled={thinkingEnabled}
                onThinkingEnabledChange={setThinkingEnabled}
              />
            )}
            {activeView === "settings" && (
              <SettingsPage
                key={settingsInitialTab}
                initialTab={settingsInitialTab}
                onClose={() => setActiveView("chat")}
                onGoToCustomize={(tab) => handleGoToView("customize", tab)}
                onUpgradeClick={() => {
                  setActiveView("chat");
                  setShowUpgradeView(true);
                }}
                user={auth.user}
                onLogout={() => void auth.logout()}
              />
            )}
            {activeView === "customize" && (
              <CustomizePage
                onClose={() => setActiveView("settings")}
                initialTab={customizeTab}
              />
            )}
            {activeView === "projects" && (
              <ProjectsView
                projects={projects.projects}
                loading={projects.loading}
                onNewProject={() => setCreateProjectOpen(true)}
                onOpenProject={(projectId) => {
                  const project = projects.projects.find((p) => p.id === projectId);
                  if (project) openProjectDetail(project);
                }}
              />
            )}
            {activeView === "project-detail" && activeProject && (
              <ProjectDetailView
                project={activeProject}
                onBack={() => {
                  setDetailProject(null);
                  setActiveProjectId(null);
                  handleGoToView("projects");
                }}
                onSendMessage={(prompt) => {
                  handleSendMessage(prompt);
                  setActiveView("chat");
                }}
                onStopGeneration={stopGeneration}
                isGenerating={isGenerating}
                thinkingEnabled={thinkingEnabled}
                onThinkingEnabledChange={setThinkingEnabled}
              />
            )}
            {activeView === "project-detail" && !activeProject && (
              <div className="flex flex-1 items-center justify-center bg-white text-zinc-500">
                Project not found.{" "}
                <button
                  type="button"
                  className="ml-1 underline text-zinc-800 hover:text-zinc-900"
                  onClick={() => handleGoToView("projects")}
                >
                  Back to projects
                </button>
              </div>
            )}
            {activeView === "artifacts" && <ArtifactsView />}
            {activeView === "library" && <LibraryView />}
            {activeView === "images" && <ImagesView />}
            {activeView === "claw" && <ClauxenClawView />}
            {activeView === "deep-research" && (
              <DeepResearchView
                onSendMessage={(prompt) => {
                  handleSendMessage(prompt);
                  setActiveView("chat");
                }}
                onStopGeneration={stopGeneration}
                isGenerating={isGenerating}
              />
            )}
          </div>
        </div>
      </main>

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

      {showUpgradeView && (
        <UpgradeView onClose={() => setShowUpgradeView(false)} />
      )}

      {showAppsView && (
        <AppsExtensionsView
          onClose={() => setShowAppsView(false)}
          onUpgradeClick={() => {
            setShowAppsView(false);
            setShowUpgradeView(true);
          }}
        />
      )}

      {showGiftView && <GiftView onClose={() => setShowGiftView(false)} />}
    </div>
  );
}
