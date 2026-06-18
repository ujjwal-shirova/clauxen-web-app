"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@/frontend/hooks/use-chat";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import { Sidebar } from "@/frontend/components/sidebar";
import { ChatArea } from "@/frontend/components/chat-area";
import { UpgradeView } from "@/frontend/components/upgrade-view";
import { SettingsModal } from "@/frontend/components/settings-page";
import { AppsExtensionsView } from "@/frontend/components/apps-extensions-view";
import { GiftView } from "@/frontend/components/gift-view";
import { CustomizePage } from "@/frontend/components/customize-page";
import { ProjectsView } from "@/frontend/components/projects-view";
import { ProjectDetailView } from "@/frontend/components/project-detail-view";
import { CreateProjectDialog } from "@/frontend/components/create-project-dialog";
import { LibraryView } from "@/frontend/components/library-view";
import { cn } from "@/frontend/lib/utils";
import { useSidebarState } from "@/frontend/hooks/use-sidebar-state";
import {
  appAgentPanelClassName,
  appMainShellClassName,
  appShellRootClassName,
} from "@/frontend/lib/app-shell-layout";
import type { SettingsTab } from "@/frontend/components/settings/constants";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { useToast } from "@/frontend/hooks/use-toast";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { toast } = useToast();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [detailProject, setDetailProject] = useState<ApiProject | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const chat = useChat({
    apiEnabled: false,
    projectId: activeProjectId,
    thinkingEnabled,
    webSearchEnabled,
    chatModel,
  });
  const projects = useProjects(auth.isAuthenticated);

  const {
    messages,
    recentChats,
    startedRecentChats,
    activeChat,
    isGenerating,
    handleSendMessage,
    stopGeneration,
    startNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
    activeChatId,
  } = chat;

  const { isMobile, isSidebarCollapsed, setIsSidebarCollapsed } =
    useSidebarState();
  const [activeView, setActiveView] = useState<
    "chat" | "customize" | "projects" | "project-detail" | "library"
  >("chat");
  const [showSettings, setShowSettings] = useState(false);
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
  const viewBeforeCustomizeRef = React.useRef<
    "chat" | "projects" | "project-detail" | "library"
  >("chat");

  const activeProject =
    detailProject ??
    (activeProjectId != null
      ? (projects.projects.find((p) => p.id === activeProjectId) ?? null)
      : null);

  const projectChatsForDetail = useMemo(() => {
    if (!activeProjectId) return [];
    return startedRecentChats.filter(
      (chat) => chat.projectId === activeProjectId,
    );
  }, [activeProjectId, startedRecentChats]);

  const closeMobileNav = React.useCallback(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [isMobile]);

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
    const projectId = searchParams.get("project");
    const prompt = searchParams.get("prompt");
    if (!projectId && !prompt) return;

    if (projectId) {
      setActiveProjectId(projectId);
    }
    if (prompt) {
      const decoded = decodeURIComponent(prompt);
      handleSendMessage(decoded);
      setActiveView("chat");
    }
    router.replace("/", { scroll: false });
  }, [searchParams, router, handleSendMessage]);

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
    view: "chat" | "customize" | "projects" | "project-detail" | "library",
    tab?: "skills" | "connectors",
  ) => {
    if (view === "customize" && activeView !== "customize") {
      viewBeforeCustomizeRef.current = activeView;
    }

    setCustomizeTab(tab || null);
    setActiveView(view);

    if (isMobile) {
      setIsSidebarCollapsed(true);
    } else if (view === "customize") {
      setIsSidebarCollapsed(true);
    }
  };

  const handleCloseCustomize = React.useCallback(() => {
    const previousView = viewBeforeCustomizeRef.current;
    setCustomizeTab(null);
    setActiveView(previousView);

    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  }, [isMobile, setIsSidebarCollapsed]);

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
      activeView === "projects" ||
      activeView === "project-detail" ||
      activeView === "library");

  const openSettings = React.useCallback(
    (tab: SettingsTab = "General") => {
      setSettingsInitialTab(tab);
      setShowSettings(true);
      closeMobileNav();
    },
    [closeMobileNav],
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
        onNavigate={closeMobileNav}
        onUpgradeClick={() => {
          setShowUpgradeView(true);
          closeMobileNav();
        }}
        onSettingsClick={() => openSettings("General")}
        onPersonalizationClick={() => openSettings("Personalization")}
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
          router.push("/projects");
          closeMobileNav();
        }}
        onLibraryClick={() => handleGoToView("library")}
        onCustomizeClick={() => handleGoToView("customize")}
        onHistoryClick={() => handleGoToView("chat")}
        activeView={activeView === "project-detail" ? "projects" : activeView}
        recentChats={startedRecentChats}
        activeChatId={activeChatId}
        onSelectChat={(chatId) => {
          handleSelectChat(chatId);
          closeMobileNav();
        }}
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
          fullBleed: isMobileFullBleedView,
        })}
      >
        <div
          data-component="agent-panel"
          data-layout="panel"
          className={appAgentPanelClassName({
            isMobile,
            fullBleed: isMobileFullBleedView,
          })}
        >
          <div
            className={cn(
              "flex min-h-0 h-full w-full max-w-full flex-1 flex-col overflow-hidden",
              "items-stretch",
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
                redoUserMessageWithBranch={redoUserMessageWithBranch}
                retryAssistantWithBranch={retryAssistantWithBranch}
                switchMessageBranch={switchMessageBranch}
                activeChatId={activeChatId}
                activeChatTitle={activeChat?.name ?? "New Chat"}
                isActiveChatTitleStreaming={!!activeChat?.isTitleStreaming}
                isActiveChatPinned={!!activeChat?.pinned}
                onRenameChat={handleRenameChat}
                onPinChat={handlePinChat}
                onDeleteChat={handleDeleteChat}
                onOpenSettings={() => openSettings("General")}
                onMoveToProject={() => handleGoToView("projects")}
                thinkingEnabled={thinkingEnabled}
                onThinkingEnabledChange={setThinkingEnabled}
                webSearchEnabled={webSearchEnabled}
                onWebSearchEnabledChange={setWebSearchEnabled}
                chatModel={chatModel}
                onChatModelChange={setChatModel}
                onOpenMobileNav={() => setIsSidebarCollapsed(false)}
                showMobileMenu={isMobile && isSidebarCollapsed}
              />
            )}
            {activeView === "customize" && (
              <CustomizePage
                onClose={handleCloseCustomize}
                initialTab={customizeTab}
              />
            )}
            {activeView === "projects" && (
              <ProjectsView
                projects={projects.projects}
                loading={projects.loading}
                onNewProject={() => setCreateProjectOpen(true)}
                onOpenProject={(projectId) => {
                  const project = projects.projects.find(
                    (p) => p.id === projectId,
                  );
                  if (project) openProjectDetail(project);
                }}
                onOpenMobileNav={() => setIsSidebarCollapsed(false)}
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
                onSendMessage={async (prompt) => {
                  startNewChat();
                  await handleSendMessage(prompt);
                  setActiveView("chat");
                }}
                onStopGeneration={stopGeneration}
                isGenerating={isGenerating}
                thinkingEnabled={thinkingEnabled}
                onThinkingEnabledChange={setThinkingEnabled}
                webSearchEnabled={webSearchEnabled}
                onWebSearchEnabledChange={setWebSearchEnabled}
                chatModel={chatModel}
                onChatModelChange={setChatModel}
                projectChats={projectChatsForDetail}
                activeChatId={activeChatId}
                onOpenChat={(chatId) => {
                  handleSelectChat(chatId);
                  setActiveView("chat");
                }}
                onRenameChat={handleRenameChat}
                onDeleteChat={handleDeleteChat}
                onPinChat={handlePinChat}
                onOpenMobileNav={() => setIsSidebarCollapsed(false)}
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
            {activeView === "library" && <LibraryView />}
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

      <SettingsModal
        key={settingsInitialTab}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsInitialTab}
        onGoToCustomize={(tab) => {
          setShowSettings(false);
          handleGoToView("customize", tab);
        }}
        onUpgradeClick={() => {
          setShowSettings(false);
          setShowUpgradeView(true);
        }}
        user={auth.user}
        onLogout={() => void auth.logout()}
      />
    </div>
  );
}
