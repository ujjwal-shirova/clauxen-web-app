"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatArea } from "@/frontend/components/chat-area";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useProjectChat } from "@/frontend/hooks/use-project-chat";
import { useProjectsShell } from "@/frontend/components/projects/projects-shell-context";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { useChatStore } from "@/frontend/stores/chat-store";
import { useState } from "react";

type PageProps = {
  params: Promise<{ id: string; convId: string }>;
};

export default function ProjectConversationPage({ params }: PageProps) {
  const { id: projectId, convId } = use(params);
  const router = useRouter();
  const auth = useAuth();
  const { isMobile, openMobileNav, isSidebarCollapsed } = useProjectsShell();
  const projectsHook = useProjects(auth.isAuthenticated);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const chat = useProjectChat(projectId, {
    thinkingEnabled,
    webSearchEnabled,
    chatModel,
  });

  const {
    messages,
    activeChat,
    activeChatId,
    isGenerating,
    handleSendMessage,
    stopGeneration,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
  } = chat;

  useEffect(() => {
    let cancelled = false;
    const cached = projectsHook.projects.find((p) => p.id === projectId);
    if (cached) {
      setProject(cached);
      return;
    }
    if (auth.isAuthenticated && !projectId.startsWith("local-")) {
      void projectsApi.getProject(projectId).then(
        ({ project: row }) => {
          if (!cancelled) setProject(row);
        },
        () => {
          if (!cancelled) setProject(null);
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [projectId, auth.isAuthenticated, projectsHook.projects]);

  useEffect(() => {
    if (activeChatId === convId) {
      const existing = useChatStore.getState().messageIdsByChatId[convId];
      if (existing?.length) return;
    }
    void handleSelectChat(convId);
  }, [convId, activeChatId, handleSelectChat]);

  const handleDeleteAndNavigate = async (chatId: string) => {
    await handleDeleteChat(chatId);
    router.push(`/projects/${projectId}`);
  };

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500 lg:rounded-[inherit]">
        Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        onStopGeneration={stopGeneration}
        isGenerating={isGenerating}
        onUpgradeClick={() => router.push("/")}
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
        onDeleteChat={handleDeleteAndNavigate}
        onOpenSettings={() => router.push("/")}
        onMoveToProject={() => router.push("/projects")}
        thinkingEnabled={thinkingEnabled}
        onThinkingEnabledChange={setThinkingEnabled}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={setWebSearchEnabled}
        chatModel={chatModel}
        onChatModelChange={setChatModel}
        onOpenMobileNav={openMobileNav}
        showMobileMenu={isMobile && isSidebarCollapsed}
        projectBreadcrumb={{
          label: project.name,
          onClick: () => router.push(`/projects/${projectId}`),
        }}
      />
    </div>
  );
}
