"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { ApiProject } from "@/lib/api/projects";
import { ProjectListRow } from "@/components/projects/project-list-row";
import { ProjectsMobileHeader } from "@/components/projects/projects-mobile-header";
import { useAppLayout } from "@/components/app-layout-context";
import {
  ProjectSortMenu,
  sortProjects,
  type ProjectSortKey,
} from "@/components/projects/project-sort-menu";
import { Button } from "@/components/ui/button";

interface ProjectsViewMobileProps {
  projects: ApiProject[];
  loading?: boolean;
  pinnedIds?: string[];
  onNewProject: () => void;
  onOpenProject?: (projectId: string) => void;
  onTogglePin?: (projectId: string, pinned: boolean) => void;
  onOpenMobileNav?: () => void;
}

const SEARCH_DEBOUNCE_MS = 320;

export function ProjectsViewMobile({
  projects,
  loading,
  pinnedIds = [],
  onNewProject,
  onOpenProject,
  onTogglePin,
  onOpenMobileNav,
}: ProjectsViewMobileProps) {
  const shell = useAppLayout();
  const openNav = onOpenMobileNav ?? shell.openMobileNav;
  const isNavOpen = onOpenMobileNav ? false : !shell.isSidebarCollapsed;
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
  const showList = !showSkeletons && filtered.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)] lg:hidden">
      <ProjectsMobileHeader
        title="Projects"
        onOpenMobileNav={openNav}
        isNavOpen={isNavOpen}
        trailing={
          <button
            type="button"
            onClick={onNewProject}
            aria-label="New project"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.25} />
          </button>
        }
      />

      <div className="shrink-0 border-b border-zinc-100 bg-white px-3 pb-3 pt-1 sm:px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {showList ? (
            <p className="text-[12px] text-zinc-500">
              {filtered.length} project{filtered.length === 1 ? "" : "s"}
            </p>
          ) : (
            <span />
          )}
          <ProjectSortMenu value={sortKey} onChange={setSortKey} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-4">
        {showSkeletons ? (
          <ul className="flex flex-col gap-2 p-0">
            {Array.from({ length: 5 }, (_, index) => (
              <li
                key={index}
                className="h-[68px] animate-pulse rounded-xl bg-zinc-100"
              />
            ))}
          </ul>
        ) : null}

        {isEmptySearch ? (
          <p className="py-16 text-center text-[14px] text-zinc-500">
            No projects matching &ldquo;{debouncedQuery.trim()}&rdquo;
          </p>
        ) : null}

        {isEmptyLibrary ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <Plus className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h3 className="mb-5 text-[15px] font-medium text-zinc-800">
              No projects yet
            </h3>
            <Button
              type="button"
              onClick={onNewProject}
              className="h-10 rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white hover:bg-zinc-800"
            >
              New project
            </Button>
          </div>
        ) : null}

        {showList ? (
          <ul className="flex flex-col gap-2 p-0">
            {filtered.map((project) => (
              <ProjectListRow
                key={project.id}
                project={project}
                starred={pinned.has(project.id)}
                onOpen={() => onOpenProject?.(project.id)}
                onToggleStar={() =>
                  onTogglePin?.(project.id, !pinned.has(project.id))
                }
              />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
