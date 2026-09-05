"use client";

import { useCallback } from "react";
import { ProjectsView } from "@/components/projects-view";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useAppLayout } from "@/components/app-layout-context";
import { APP_ROUTES } from "@/lib/app-routes";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";

export function ProjectsLibraryScreen() {
  const instantNavigate = useInstantNavigate();
  const auth = useAuth();
  const apiEnabled = Boolean(auth.user?.id);
  const projects = useProjects(apiEnabled);
  const { openMobileNav } = useAppLayout();

  const openProject = useCallback(
    (projectId: string) => {
      instantNavigate(APP_ROUTES.project(projectId));
    },
    [instantNavigate],
  );

  return (
    <ProjectsView
      projects={projects.projects}
      loading={projects.loading && projects.projects.length === 0}
      pinnedIds={projects.pinnedIds}
      onNewProject={() => instantNavigate(APP_ROUTES.projectNew)}
      onOpenProject={openProject}
      onTogglePin={(projectId, pinned) => projects.pinProject(projectId, pinned)}
      onDeleteProject={(project) => {
        void projects.deleteProject(project.id);
      }}
      onOpenMobileNav={openMobileNav}
    />
  );
}
