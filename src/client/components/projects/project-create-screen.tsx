"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreateProjectForm } from "@/components/create-project-form";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";
import { APP_ROUTES } from "@/lib/app-routes";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { useAppLayout } from "@/components/app-layout-context";
import { ProjectsMobileHeader } from "@/components/projects/projects-mobile-header";
import * as projectsApi from "@/lib/api/projects";

export function ProjectCreateScreen() {
  return (
    <Suspense
      fallback={
        <div className="h-full min-h-0 w-full flex-1 bg-[var(--app-panel-bg)]" />
      }
    >
      <ProjectCreateContent />
    </Suspense>
  );
}

function ProjectCreateContent() {
  const instantNavigate = useInstantNavigate();
  const searchParams = useSearchParams();
  const attachChatId = searchParams.get("chatId")?.trim() || null;
  const auth = useAuth();
  const projects = useProjects(Boolean(auth.user?.id));
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const showMobileMenu = isMobile && isSidebarCollapsed;

  const handleCreate = ({
    name,
    description,
    icon,
    color,
  }: {
    name: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    if (!auth.user?.id) {
      setCreateError("Sign in to create a project.");
      return;
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(16)}-0000-4000-8000-${Math.random()
            .toString(16)
            .slice(2, 14)
            .padEnd(12, "0")}`;
    setCreateError(null);
    setIsCreating(true);
    // Optimistic row lands in the cache before the first await — open the
    // dashboard immediately and let the POST finish in the background.
    void projects
      .createProject({
        id,
        name,
        description: description || undefined,
        icon,
        color,
      })
      .then(async (project) => {
        if (!project) {
          setIsCreating(false);
          setCreateError("Enter a project name and try again.");
          return;
        }
        if (attachChatId) {
          try {
            await projectsApi.linkChatToProject(project.id, attachChatId);
          } catch {
            /* project still created — chat can be added from the dashboard */
          }
        }
      })
      .catch(() => {
        setCreateError("Couldn’t create the project right now. Please retry.");
        setIsCreating(false);
      });
    instantNavigate(APP_ROUTES.project(id), { replace: true });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto bg-[var(--app-panel-bg)]">
      {showMobileMenu ? (
        <ProjectsMobileHeader
          title="New project"
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
          borderless
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
        <CreateProjectForm
          onSubmit={handleCreate}
          cancelHref={APP_ROUTES.projects}
          isSubmitting={isCreating}
          errorMessage={createError}
        />
      </div>
    </div>
  );
}
