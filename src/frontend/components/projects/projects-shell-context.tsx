"use client";

import { createContext, useContext } from "react";

export type ProjectsShellContextValue = {
  isMobile: boolean;
  isSidebarCollapsed: boolean;
  openMobileNav: () => void;
};

const ProjectsShellContext = createContext<ProjectsShellContextValue | null>(
  null,
);

export function ProjectsShellProvider({
  value,
  children,
}: {
  value: ProjectsShellContextValue;
  children: React.ReactNode;
}) {
  return (
    <ProjectsShellContext.Provider value={value}>
      {children}
    </ProjectsShellContext.Provider>
  );
}

export function useProjectsShell(): ProjectsShellContextValue {
  return (
    useContext(ProjectsShellContext) ?? {
      isMobile: false,
      isSidebarCollapsed: true,
      openMobileNav: () => {},
    }
  );
}
