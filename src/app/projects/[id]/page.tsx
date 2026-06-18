"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useProjectChat } from "@/frontend/hooks/use-project-chat";
import { ProjectDetailView } from "@/frontend/components/project-detail-view";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const auth = useAuth();
  const projectsHook = useProjects(auth.isAuthenticated);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const {
    projectChats,
    activeChatId,
    isGenerating,
    handleSendMessage,
    stopGeneration,
    startNewChat,
    handleRenameChat,
    handleDeleteChat,
    handlePinChat,
  } = useProjectChat(id, {
    thinkingEnabled,
    webSearchEnabled,
    chatModel,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const cached = projectsHook.projects.find((p) => p.id === id);
      if (cached) {
        if (!cancelled) {
          setProject(cached);
          setLoading(false);
        }
        return;
      }
      if (auth.isAuthenticated && !id.startsWith("local-")) {
        try {
          const { project: row } = await projectsApi.getProject(id);
          if (!cancelled) setProject(row);
        } catch {
          if (!cancelled) setProject(null);
        }
      }
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, auth.isAuthenticated, projectsHook.projects]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500">
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500">
        <p>Project not found.</p>
        <button
          type="button"
          className="text-sm underline text-zinc-800"
          onClick={() => router.push("/projects")}
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <ProjectDetailView
      project={project}
      onBack={() => router.push("/projects")}
      onSendMessage={async (prompt) => {
        startNewChat();
        const chatId = await handleSendMessage(prompt);
        if (chatId) {
          router.push(`/projects/${id}/conversations/${chatId}`);
        }
      }}
      onStopGeneration={stopGeneration}
      isGenerating={isGenerating}
      thinkingEnabled={thinkingEnabled}
      onThinkingEnabledChange={setThinkingEnabled}
      webSearchEnabled={webSearchEnabled}
      onWebSearchEnabledChange={setWebSearchEnabled}
      chatModel={chatModel}
      onChatModelChange={setChatModel}
      projectChats={projectChats}
      activeChatId={activeChatId}
      onOpenChat={(chatId) =>
        router.push(`/projects/${id}/conversations/${chatId}`)
      }
      onRenameChat={handleRenameChat}
      onDeleteChat={handleDeleteChat}
      onPinChat={handlePinChat}
    />
  );
}
