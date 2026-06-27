"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { Plus, Search } from "lucide-react";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { ProjectCard } from "@/frontend/components/projects/project-card";
import { ProjectCardSkeletonGrid } from "@/frontend/components/projects/project-card-skeleton";
import {
  ProjectSortMenu,
  sortProjects,
  type ProjectSortKey,
} from "@/frontend/components/projects/project-sort-menu";
import { Button } from "@/frontend/components/ui/button";
import { ProjectsViewMobile } from "@/frontend/components/projects/projects-view-mobile";
import { useIsMobile } from "@/frontend/hooks/use-mobile";

interface ProjectsViewProps {
  projects: ApiProject[];
  loading?: boolean;
  onNewProject: () => void;
  onOpenProject?: (projectId: string) => void;
  onEditProject?: (project: ApiProject) => void;
  onDeleteProject?: (project: ApiProject) => void;
  onOpenMobileNav?: () => void;
}

const SEARCH_DEBOUNCE_MS = 320;

export function ProjectsView({
  projects,
  loading,
  onNewProject,
  onOpenProject,
  onEditProject,
  onDeleteProject,
  onOpenMobileNav,
}: ProjectsViewProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("recent_activity");
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set());

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
    loading || (isSearchPending && debouncedQuery.trim().length > 0);
  const hasSearchQuery = debouncedQuery.trim().length > 0;
  const isEmptySearch =
    !showSkeletons && hasSearchQuery && filtered.length === 0;
  const isEmptyLibrary =
    !showSkeletons && !hasSearchQuery && !loading && projects.length === 0;
  const showGrid = !showSkeletons && filtered.length > 0;

  const toggleStar = (projectId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  return (
    <>
      {isMobile ? (
        <ProjectsViewMobile
          projects={projects}
          loading={loading}
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onOpenMobileNav={onOpenMobileNav}
        />
      ) : null}

      <div
        className={cn(
          "flex h-full w-full flex-1 flex-col overflow-hidden bg-white font-sans text-zinc-900",
          isMobile && "hidden",
        )}
      >
      <div className="w-full shrink-0 border-b border-zinc-100">
        <div className="mobile-page-inset mx-auto w-full max-w-[880px] pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-5 sm:pt-6 lg:pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-serif text-[24px] font-medium leading-[1.25] tracking-[-0.2px] text-zinc-800 sm:text-[28px] sm:leading-[34px]">
                Projects
              </h1>
              <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                Organize chats, files, and instructions in one place.
              </p>
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
              <ProjectSortMenu value={sortKey} onChange={setSortKey} />
              <Button
                type="button"
                onClick={onNewProject}
                className="h-9 shrink-0 gap-1.5 rounded-full bg-zinc-900 px-4 text-[14px] font-medium text-white shadow-sm hover:bg-zinc-800 active:scale-[0.985]"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden min-[380px]:inline">New project</span>
                <span className="min-[380px]:hidden">New</span>
              </Button>
            </div>
          </div>

          <div className="relative mt-4 sm:mt-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              aria-label="Search projects"
              className="h-10 w-full rounded-full border border-zinc-200 bg-white pl-10 pr-4 text-[14px] text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mobile-page-inset mx-auto w-full max-w-[880px] px-0 pb-24 pt-5 sm:px-6 sm:pt-6">
          {showSkeletons && <ProjectCardSkeletonGrid count={6} />}

          {isEmptySearch && (
            <p className="py-16 text-center text-[14px] leading-5 text-zinc-500">
              No projects matching &ldquo;{debouncedQuery.trim()}&rdquo;
            </p>
          )}

          {isEmptyLibrary && (
            <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-300">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  aria-hidden
                >
                  <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                </svg>
              </div>
              <h3 className="mb-2 text-[15px] font-medium text-zinc-800">
                Create your first project
              </h3>
              <p className="mb-6 max-w-[380px] text-[13.5px] leading-relaxed text-zinc-500">
                Upload materials, set custom instructions, and keep related
                conversations together.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onNewProject}
                className="h-9 rounded-full border-zinc-200 px-4 text-[13.5px] font-medium text-zinc-900 hover:bg-zinc-50"
              >
                New project
              </Button>
            </div>
          )}

          {showGrid && (
            <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  starred={starredIds.has(project.id)}
                  onOpen={() => onOpenProject?.(project.id)}
                  onToggleStar={() => toggleStar(project.id)}
                  onEditDetails={() => onEditProject?.(project)}
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
