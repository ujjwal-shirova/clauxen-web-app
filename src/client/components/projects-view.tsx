"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import type { ApiProject } from "@/lib/api/projects";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectCardSkeletonGrid } from "@/components/projects/project-card-skeleton";
import {
  ProjectSortMenu,
  sortProjects,
  type ProjectSortKey,
} from "@/components/projects/project-sort-menu";
import { ProjectsViewMobile } from "@/components/projects/projects-view-mobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { appPage } from "@/lib/app-page-chrome";
import { useAppLayout } from "@/components/app-layout-context";
import { MobileMenuButton } from "@/components/mobile-menu-button";

interface ProjectsViewProps {
  projects: ApiProject[];
  loading?: boolean;
  pinnedIds?: string[];
  onNewProject: () => void;
  onOpenProject?: (projectId: string) => void;
  onTogglePin?: (projectId: string, pinned: boolean) => void;
  onDeleteProject?: (project: ApiProject) => void;
  onOpenMobileNav?: () => void;
}

const SEARCH_DEBOUNCE_MS = 320;

export function ProjectsView({
  projects,
  loading,
  pinnedIds = [],
  onNewProject,
  onOpenProject,
  onTogglePin,
  onDeleteProject,
  onOpenMobileNav,
}: ProjectsViewProps) {
  const isMobile = useIsMobile();
  const { isSidebarCollapsed, openMobileNav } = useAppLayout();
  const openNav = onOpenMobileNav ?? openMobileNav;
  const showDesktopMenu = !isMobile && isSidebarCollapsed;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("recent_activity");
  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  useEffect(() => {
    if (query === debouncedQuery) {
      setIsSearchPending(false);
      return;
    }
    setIsSearchPending(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearchPending(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, debouncedQuery]);

  const sorted = useMemo(
    () => sortProjects(projects, sortKey),
    [projects, sortKey],
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [sorted, debouncedQuery]);

  const showSkeletons =
    Boolean(loading && projects.length === 0) ||
    (isSearchPending && debouncedQuery.trim().length > 0);
  const hasSearchQuery = debouncedQuery.trim().length > 0;
  const isEmptySearch =
    !showSkeletons && hasSearchQuery && filtered.length === 0;
  const isEmptyLibrary =
    !showSkeletons && !hasSearchQuery && !loading && projects.length === 0;
  const showGrid = !showSkeletons && filtered.length > 0;

  return (
    <>
      {isMobile ? (
        <ProjectsViewMobile
          projects={projects}
          loading={loading}
          pinnedIds={pinnedIds}
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onTogglePin={onTogglePin}
          onOpenMobileNav={openNav}
        />
      ) : null}

      <div className={cn(appPage.surface, isMobile && "hidden")}>
        <div className={appPage.headerBleed}>
          <div className={appPage.headerInner}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                {showDesktopMenu ? (
                  <MobileMenuButton
                    onClick={openNav}
                    aria-controls="app-primary-nav"
                    className="mt-0.5 lg:flex"
                  />
                ) : null}
                <div className="min-w-0">
                  <h1 className={appPage.title}>Projects</h1>
                </div>
              </div>

              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
                <ProjectSortMenu value={sortKey} onChange={setSortKey} />
                <button
                  type="button"
                  onClick={onNewProject}
                  className={appPage.primaryCta}
                >
                  <Plus className="icon-md" />
                  <span className="hidden min-[380px]:inline">New project</span>
                  <span className="min-[380px]:hidden">New</span>
                </button>
              </div>
            </div>

            <div className={appPage.searchWrap}>
              <Search className={appPage.searchIcon} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
                className={appPage.searchInput}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={appPage.content}>
            {showSkeletons ? <ProjectCardSkeletonGrid count={6} /> : null}

            {isEmptySearch && (
              <p className="py-16 text-center text-[14px] leading-5 text-zinc-500">
                No projects matching &ldquo;{debouncedQuery.trim()}&rdquo;
              </p>
            )}

            {isEmptyLibrary && (
              <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
                <div className={appPage.emptyIconWell}>
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                  </svg>
                </div>
                <h3 className={appPage.emptyTitle}>No projects yet</h3>
                <button
                  type="button"
                  onClick={onNewProject}
                  className={cn(appPage.outlineCta, "mt-5")}
                >
                  New project
                </button>
              </div>
            )}

            {showGrid && (
              <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                {filtered.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    starred={pinned.has(project.id)}
                    onOpen={() => onOpenProject?.(project.id)}
                    onToggleStar={() =>
                      onTogglePin?.(project.id, !pinned.has(project.id))
                    }
                    onEditDetails={() => onOpenProject?.(project.id)}
                    onDelete={() => onDeleteProject?.(project)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
