"use client";

import { useMemo } from "react";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { ProjectDashboard } from "./project-dashboard";
import { ProjectsGallery } from "./projects-gallery";

export { CreateProjectDialog, ProjectDetailsDialog } from "./project-dialogs";
export { ProjectIconPicker, ProjectMark } from "./project-icon";

/** `/projects` renders the gallery; `/projects/:id` renders that dashboard. */
export function ProjectsView() {
  const pathname = useAppPathname();
  const projectId = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  if (projectId) return <ProjectDashboard projectId={projectId} />;
  return <ProjectsGallery />;
}
