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

export default function ProjectCreateRoutePage() {
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

  const handleCreate = async ({
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
    setIsCreating(true);
    setCreateError(null);
    try {
      const project = await projects.createProject({
        name,
        description: description || undefined,
        icon,
        color,
      });
      if (project) {
        if (attachChatId) {
          try {
            await projectsApi.linkChatToProject(project.id, attachChatId);
          } catch {
            /* project still created — chat can be added from the dashboard */
          }
        }
        instantNavigate(APP_ROUTES.project(project.id), { replace: true });
        return;
      }
      setCreateError("Enter a project name and try again.");
    } catch {
      setCreateError("Couldn’t create the project right now. Please retry.");
    } finally {
      setIsCreating(false);
    }
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
