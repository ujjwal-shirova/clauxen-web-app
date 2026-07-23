"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatView } from "@/frontend/components/chat-view";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useProjects } from "@/frontend/hooks/use-projects";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { APP_ROUTES } from "@/frontend/lib/app-routes";

export default function ProjectHomeRoutePage() {
  return (
    <Suspense fallback={null}>
      <ProjectHomeGate />
    </Suspense>
  );
}

function ProjectHomeGate() {
  const auth = useAuth();
  // Paint ChatView immediately — project name resolves in parallel.
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
  const router = useRouter();
  const projectsHook = useProjects(apiEnabled);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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

  const breadcrumb = useMemo(
    () =>
      project
        ? {
            label: project.name,
            onClick: () => router.push(APP_ROUTES.project(id)),
          }
        : undefined,
    [project, id, router],
  );

  if (loadFailed && !project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500">
        <p>Project not found.</p>
        <button
          type="button"
          className="text-sm text-zinc-800 underline"
          onClick={() => router.push(APP_ROUTES.projects)}
        >
          New project
        </button>
      </div>
    );
  }

  // Project dashboard = blank new-chat composer scoped to this project.
  return (
    <ChatView projectId={id} projectBreadcrumb={breadcrumb} />
  );
}
