"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatView } from "@/frontend/components/chat-view";
import { useProjects } from "@/frontend/hooks/use-projects";
import { useAuth } from "@/frontend/hooks/use-auth";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";

function ProjectConversationContent() {
  const params = useParams<{ id: string; convId: string }>();
  const projectId = params?.id ?? "";
  const router = useRouter();
  const auth = useAuth();
  const projectsHook = useProjects(auth.isAuthenticated);

  const [project, setProject] = useState<ApiProject | null>(null);

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

  const breadcrumb = project
    ? {
        label: project.name,
        onClick: () => router.push(`/projects/${projectId}`),
      }
    : undefined;

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500 lg:rounded-[inherit]">
        Loading conversation…
      </div>
    );
  }

  // Authenticated project conversations run through the server chat API
  // (same path that created the chat from the project home) so messages
  // persist and stream via /api/v1/chats/[chatId]/generate.
  return (
    <ChatView
      projectId={projectId}
      apiEnabled={auth.isAuthenticated}
      projectBreadcrumb={breadcrumb}
    />
  );
}

export default function ProjectConversationRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectConversationContent />
    </Suspense>
  );
}
