"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectHomeView } from "@/components/project-home-view";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useOptionalChatSession } from "@/contexts/chat-session-context";
import { useAppLayout } from "@/components/app-layout-context";
import * as projectsApi from "@/lib/api/projects";
import type { ApiProject } from "@/lib/api/projects";
import { APP_ROUTES, getProjectIdFromPath } from "@/lib/app-routes";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/project-limits";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { isProjectPinned } from "@/lib/pinned-projects";
import { AppHref } from "@/components/app-href";
import { AppContentLoader } from "@/components/app-content-loader";
import { useAppPathname } from "@/hooks/use-app-pathname";
import type { RecentChat } from "@/lib/types";

export function ProjectHomeScreen({ projectId }: { projectId?: string }) {
  const auth = useAuth();
  const pathname = useAppPathname();
  const id = projectId || getProjectIdFromPath(pathname) || "";
  return (
    <ProjectHomeContent
      key={`${auth.user?.id ?? "anon"}:${id}`}
      apiEnabled={Boolean(auth.user?.id)}
      id={id}
    />
  );
}

function ProjectHomeContent({
  apiEnabled,
  id,
}: {
  apiEnabled: boolean;
  id: string;
}) {
  const instantNavigate = useInstantNavigate();
  const projectsHook = useProjects(apiEnabled);
  const session = useOptionalChatSession();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fetchedChats, setFetchedChats] = useState<RecentChat[]>([]);
  const cachedProject =
    projectsHook.projects.find((item) => item.id === id) ?? null;
  const visibleProject = project ?? cachedProject;

  useEffect(() => {
    let cancelled = false;
    const cached = projectsHook.projects.find((p) => p.id === id);
    if (cached) {
      setProject(cached);
      setLoadFailed(false);
      return;
    }
    if (!id) {
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

  useEffect(() => {
    if (!id || !apiEnabled) return;
    let cancelled = false;
    void projectsApi.listProjectChats(id).then(
      ({ chats }) => {
        if (cancelled) return;
        setFetchedChats(
          chats.map((chat) => ({
            id: chat.id,
            name: chat.title || "New chat",
            pinned: chat.starred,
            projectId: chat.project_id,
            updatedAt: Date.parse(chat.updated_at) || undefined,
          })),
        );
      },
      () => {
        if (!cancelled) setFetchedChats([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, apiEnabled]);

  const projectChats = useMemo(() => {
    const fromSession = (session?.startedRecentChats ?? []).filter(
      (chat) => chat.projectId === id,
    );
    const byId = new Map<string, RecentChat>();
    for (const chat of fetchedChats) byId.set(chat.id, chat);
    for (const chat of fromSession) byId.set(chat.id, chat);
    return Array.from(byId.values()).sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    );
  }, [fetchedChats, id, session?.startedRecentChats]);

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
            instantNavigate(APP_ROUTES.projectChat(id, newId), {
              replace: true,
            });
          },
        });
        if (chatId) {
          const pathNow =
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : "";
          const target = APP_ROUTES.projectChat(id, chatId);
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

  if (loadFailed && !visibleProject) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500">
        <p>Project not found.</p>
        <AppHref
          href={APP_ROUTES.projects}
          className="text-sm text-zinc-800 underline"
        >
          All projects
        </AppHref>
      </div>
    );
  }

  if (!visibleProject) {
    return <AppContentLoader label="Opening project" />;
  }

  const pinned = isProjectPinned(visibleProject.id, projectsHook.pinnedIds);

  return (
    <ProjectHomeView
      project={visibleProject}
      pinned={pinned}
      onPinChange={(next) => projectsHook.pinProject(visibleProject.id, next)}
      onSendMessage={handleSendMessage}
      onStopGeneration={() => session?.stopGeneration()}
      isGenerating={isGenerating || Boolean(session?.isGenerating)}
      onSaveInstructions={async (text) => {
        if (apiEnabled) {
          await projectsHook.updateProject(id, { system_prompt: text });
        }
      }}
      onSaveAppearance={async (next) => {
        if (!apiEnabled) return;
        const updated = await projectsHook.updateProject(id, {
          icon: next.icon,
          color: next.color,
        });
        setProject(updated);
      }}
      onSaveName={async (name) => {
        const nextName = name.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
        if (!nextName || nextName === visibleProject.name) return;
        setProject((prev) => (prev ? { ...prev, name: nextName } : prev));
        if (!apiEnabled) return;
        const updated = await projectsHook.updateProject(id, { name: nextName });
        setProject(updated);
      }}
      projectChats={projectChats}
      onOpenChat={(chatId) =>
        instantNavigate(APP_ROUTES.projectChat(id, chatId))
      }
      onOpenMobileNav={openMobileNav}
      showMobileMenu={isMobile && isSidebarCollapsed}
    />
  );
}
