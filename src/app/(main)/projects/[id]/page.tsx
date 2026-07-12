"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProjectDetailView } from "@/frontend/components/project-detail-view";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useProjectChat } from "@/frontend/hooks/use-project-chat";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";

export default function ProjectDetailRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetailRouteGate />
    </Suspense>
  );
}

function ProjectDetailRouteGate() {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500">
        Loading project…
      </div>
    );
  }
  return (
    <ProjectDetailRouteContent
      key={auth.user?.id ?? "anon"}
      apiEnabled={Boolean(auth.user)}
    />
  );
}

function ProjectDetailRouteContent({ apiEnabled }: { apiEnabled: boolean }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const auth = useAuth();
  const projectsHook = useProjects(apiEnabled);

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);

  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);

  const chat = useProjectChat(id, {
    apiEnabled,
    homerReasoningEffort,
    chatModel,
  });

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
  } = chat;

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
      if (apiEnabled && !id.startsWith("local-")) {
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
  }, [id, apiEnabled, projectsHook.projects]);

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
        const chatId = await handleSendMessage(prompt, { forceNewChat: true });
        if (chatId) {
          router.push(`/projects/${id}/conversations/${chatId}`);
        }
      }}
      onStopGeneration={stopGeneration}
      isGenerating={isGenerating}
      homerReasoningEffort={homerReasoningEffort}
      onHomerReasoningEffortChange={setHomerReasoningEffort}
      chatModel={chatModel}
      onChatModelChange={setChatModel}
      projectChats={projectChats}
      activeChatId={activeChatId}
      onOpenChat={(chatId) =>
        router.push(`/projects/${id}/conversations/${chatId}`)
      }
      onNewChat={startNewChat}
      onSaveInstructions={async (text) => {
        if (apiEnabled && !id.startsWith("local-")) {
          await projectsHook.updateProject(id, { system_prompt: text });
        }
      }}
      onRenameChat={handleRenameChat}
      onDeleteChat={handleDeleteChat}
      onPinChat={handlePinChat}
    />
  );
}
