"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProjectHomeView } from "@/components/project-home-view";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useOptionalChatSession } from "@/contexts/chat-session-context";
import { useAppLayout } from "@/components/app-layout-context";
import * as projectsApi from "@/lib/api/projects";
import type { ApiProject } from "@/lib/api/projects";
import { APP_ROUTES } from "@/lib/app-routes";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { isProjectPinned } from "@/lib/pinned-projects";
import { AppHref } from "@/components/app-href";

export default function ProjectHomeRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectHomeGate />
    </Suspense>
  );
}

function ProjectHomeGate() {
  const auth = useAuth();
  return (
    <ProjectHomeContent
      key={auth.user?.id ?? "anon"}
      apiEnabled={Boolean(auth.user?.id)}
    />
  );
}

function ProjectHomeContent({ apiEnabled }: { apiEnabled: boolean }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const instantNavigate = useInstantNavigate();
  const projectsHook = useProjects(apiEnabled);
  const session = useOptionalChatSession();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = projectsHook.projects.find((p) => p.id === id);
    if (cached) {
      setProject(cached);
      setLoadFailed(false);
      return;
    }
    if (!id || id.startsWith("local-")) {
      if (!apiEnabled) {
        setProject(cached ?? null);
        setLoadFailed(!cached);
      }
      return;
    }
    if (!apiEnabled) return;

    void projectsApi.getProject(id).then(
      ({ project: row }) => {
        if (!cancelled) {
          setProject(row);
          setLoadFailed(false);
        }
      },
      () => {
        if (!cancelled) {
          setProject(null);
          setLoadFailed(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, apiEnabled, projectsHook.projects]);

  const handleSendMessage = useCallback(
    async (prompt: string) => {
      if (!session || !prompt.trim()) return;
      setIsGenerating(true);
      try {
        session.startNewChat();
        const chatId = await session.handleSendMessage(prompt, {
          forceNewChat: true,
          projectId: id,
          onChatCreated: (newId) => {
            instantNavigate(APP_ROUTES.projectChat(newId), { replace: true });
          },
        });
        if (chatId) {
          const pathNow =
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : "";
          const target = APP_ROUTES.projectChat(chatId);
          if (pathNow !== target) {
            instantNavigate(target, { replace: true });
          }
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [session, id, instantNavigate],
  );

  if (loadFailed && !project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500">
        <p>Project not found.</p>
        <AppHref
          href={APP_ROUTES.projects}
          className="text-sm text-zinc-800 underline"
        >
          New project
        </AppHref>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500">
        Loading project…
      </div>
    );
  }

  const pinned = isProjectPinned(project.id, projectsHook.pinnedIds);

  return (
    <ProjectHomeView
      project={project}
      pinned={pinned}
      onPinChange={(next) => projectsHook.pinProject(project.id, next)}
      onSendMessage={handleSendMessage}
      onStopGeneration={() => session?.stopGeneration()}
      isGenerating={isGenerating || Boolean(session?.isGenerating)}
      onSaveInstructions={async (text) => {
        if (apiEnabled && !id.startsWith("local-")) {
          await projectsHook.updateProject(id, { system_prompt: text });
        }
      }}
      onOpenMobileNav={openMobileNav}
      showMobileMenu={isMobile && isSidebarCollapsed}
    />
  );
}
