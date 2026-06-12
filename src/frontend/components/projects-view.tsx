"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { Plus, Search } from "lucide-react";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { appBtn } from "@/frontend/lib/app-buttons";
import { ProjectCard } from "@/frontend/components/projects/project-card";
import { ProjectCardSkeletonGrid } from "@/frontend/components/projects/project-card-skeleton";
import {
  ProjectSortMenu,
  sortProjects,
  type ProjectSortKey,
} from "@/frontend/components/projects/project-sort-menu";

interface ProjectsViewProps {
  projects: ApiProject[];
  loading?: boolean;
  onNewProject: () => void;
  onOpenProject?: (projectId: string) => void;
}

const SEARCH_DEBOUNCE_MS = 320;

export function ProjectsView({
  projects,
  loading,
  onNewProject,
  onOpenProject,
}: ProjectsViewProps) {
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
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      <div className="sticky top-0 z-20 bg-zinc-50">
        <div className="mobile-page-inset mx-auto w-full max-w-[896px] pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:pt-4 lg:px-8 lg:pt-6 lg:pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-[21px] font-medium tracking-[-0.3px] text-zinc-700 sm:text-[24px]">
              Projects
            </h1>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:gap-3">
              <ProjectSortMenu value={sortKey} onChange={setSortKey} />
              <button
                type="button"
                onClick={onNewProject}
                className={cn(
                  appBtn.primary,
                  "h-9 shrink-0 gap-1.5 px-3 text-[13px] sm:h-auto sm:px-4 sm:text-[13.5px]",
                )}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden min-[380px]:inline">New project</span>
                <span className="min-[380px]:hidden">New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-page-inset mx-auto w-full max-w-[896px] pt-3 sm:pt-4 lg:px-8 lg:pt-5">
        <div className="relative">
          <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[#898781]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="h-10 w-full rounded-[10px] border border-[rgba(31,31,30,0.1)] bg-white/70 pr-4 pl-10 text-[15px] transition placeholder:text-[#898781] focus:border-[rgba(31,31,30,0.2)] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mobile-page-inset mx-auto w-full max-w-[896px] pt-4 pb-20 sm:pt-5 lg:px-8 lg:pt-6">
          {showSkeletons && <ProjectCardSkeletonGrid count={6} />}

          {isEmptySearch && (
            <p className="py-12 text-center text-[14px] leading-5 text-zinc-500">
              No projects matching &ldquo;{debouncedQuery.trim()}&rdquo;
            </p>
          )}

          {isEmptyLibrary && (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <svg
                width="96"
                height="96"
                viewBox="0 0 500 500"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-6 text-[#d4d1c6]"
                aria-hidden
              >
                <path
                  d="M315.261 194.184H203.965V294.35h111.296z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <path
                  d="M62.63 60.443q-.03 9.45-.047 18.91c-.065 9.46.834 9.46.77 18.921-.065 9.451-1.327 9.451-1.392 18.902l-.055 18.911c-.065 9.46.565 9.46.51 18.92-.065 9.46-.603 9.451-.668 18.911-.065 9.451.13 9.461.065 18.911-.065 9.461.64 9.461.575 18.921s-.288 9.451-.352 18.911c-.065 9.451-.51 9.451-.566 18.911-.028 4.73.148 7.095.324 9.46.047.594.084 1.187.13 1.809l.019.241v.102l.028.037.055.046c.065.056.12.093.204.112.028 0 .047 0 .065.009l.047.019c.37 0 .723.018 1.047.018.77.019 1.457.046 2.087.065 1.271.056 2.347.111 3.46.158 2.217.111 4.563.213 8.894.204 9.46 0 9.46.547 18.911.547 9.461 0 9.461-1.076 18.912-1.085 9.46 0 9.46.501 18.911.491 9.46 0 9.46.575 18.92.566 2.365 0 4.136-.056 5.611-.148a80 80 0 0 0 2.031-.149c.427-.027.353-.055.418-.083l.111-.084c.13-.111.204-.213.223-.38.027-.167-.075-.306-.075-.436-.037-1.15-.065-2.161-.092-3.06l-.028-2.477c0-1.474.028-2.662.055-3.839.056-2.366.121-4.731-.064-9.451-.353-9.451-.77-9.433-1.123-18.884-.352-9.451.548-9.488.195-18.939-.352-9.441-1.261-9.413-1.623-18.855-.352-9.451.492-9.479.13-18.93-.065-1.892-.13-3.478-.176-4.869-.065-.992 0-1.892.148-2.671.158-.742.38-1.438.723-2.078a7.34 7.34 0 0 1 2.857-2.94 7.7 7.7 0 0 1 1.883-.742 10.7 10.7 0 0 1 2.309-.278c1.438 0 3.998.028 7.986.047 9.451.027 9.451-.13 18.911-.093 9.46.028 9.46.176 18.92.204s9.46-.557 18.911-.529c9.46.028 9.46.603 18.911.631 9.46.028 9.461-.751 18.921-.724h1.799l.074-.018c.093-.019.158-.037.204-.084.093-.102.056-.269-.028-.361a.7.7 0 0 0-.111-.121.2.2 0 0 0-.056-.037c0 .065-.018-.158-.027-.334 0-.176-.019-.352-.019-.538a144 144 0 0 1-.102-5.62c0-9.46.371-9.46.371-18.911q.046-9.46.102-18.921c0-9.46.835-9.46.835-18.92s-.149-9.46-.149-18.92c0-4.73-.241-7.096-.491-9.46a94 94 0 0 1-.334-3.84 13 13 0 0 0-.037-.566l-.019-.297c0-.083-.009-.028-.018-.055l-.047-.047-.055-.083c-.037-.056-.065-.075-.112-.13l-.055-.056s.037 0-.056-.01h-.213c-.557-.027-1.076-.046-1.577-.064a312 312 0 0 0-2.903-.148c-1.985-.093-4.248-.158-7.995-.056-9.46.25-9.451.491-18.911.751-9.451.25-9.469-.297-18.92-.046-9.46.25-9.451.63-18.902.88-9.46.251-9.469-.324-18.93-.073-9.46.25-9.441.75-18.901 1.001-9.461.25-9.461.084-18.921.334q-9.45.316-18.911.622c-9.46.25-9.451.806-18.911 1.057-9.47.25-9.488-.557-18.957-.306-9.47.25-9.47.083-18.949.334-7.299.195-8.69-1.354-8.764-4.248s1.215-4.888 8.514-5.083c9.45-.25 9.46 0 18.911-.26q9.46-.222 18.911-.435c9.451-.25 9.432-1.011 18.883-1.262 9.451-.25 9.47.473 18.921.223s9.423-1.493 18.874-1.744 9.46-.046 18.911-.306c9.451-.25 9.469.325 18.92.075s9.46-.112 18.911-.362l18.912-.39c9.45-.25 9.46.065 18.911-.185a357 357 0 0 0 7.846-.279c1.011-.046 1.957-.092 3.005-.139 1.391-.055 2.912-.11 4.739-.176.464 0 1.484-.018 2.653.297a7.35 7.35 0 0 1 3.83 2.523 7.2 7.2 0 0 1 1.234 2.346c.232.78.389 1.577.408 2.393.009 1.42.019 2.671.028 3.803.018 1.474.037 2.661.055 3.84.037 2.364.075 4.73.075 9.46 0 9.46.705 9.46.705 18.91 0 9.452.315 9.46.315 18.921s-.241 9.46-.241 18.911-.167 9.46-.167 18.921c0 2.365-.019 4.136-.056 5.611a681 681 0 0 1-.056 2.884c0 1.178-.065 2.291-.352 3.228a7.94 7.94 0 0 1-3.905 4.925c-1.103.584-2.328.955-4.043 1.001-1.317 0-2.792-.009-4.48-.018-9.451-.028-9.451.232-18.902.204s-9.451-.343-18.911-.371h-18.911c-9.451-.028-9.451.38-18.902.352s-9.451-.788-18.902-.816c-1.586 0-2.912.028-4.053.083-.287.019-.556.028-.825.047-.13 0-.26.018-.39.028l-.185.018-.037.019a.8.8 0 0 0-.214.13c-.232.167-.232.463-.083.714a.6.6 0 0 0 .222.222l.038.019h.018v.009l.019.251c.037.667.065 1.382.102 2.17q.342 9.451.677 18.892.333 9.443.695 18.902.363 9.46.742 18.902c.353 9.451-.751 9.488-.398 18.948.352 9.451.612 9.442.964 18.893q.067 1.584.121 2.986a8.7 8.7 0 0 1-.251 2.56 8 8 0 0 1-1.92 3.617 8.2 8.2 0 0 1-2.782 1.966 8.7 8.7 0 0 1-3.042.696c-1.076.037-2.161.065-3.302.102-.631.028-1.289.056-2.031.084-1.475.046-3.255.083-5.621.083-9.46 0-9.46.278-18.911.288-9.46 0-9.46-1.41-18.92-1.401-9.46 0-9.46.575-18.92.584-9.46 0-9.46.39-18.92.399-4.295 0-6.642-.028-8.886-.065-1.122-.018-2.216-.037-3.524-.055-1.67 0-3.599-.019-6.094-.037-.139 0-1.67-.019-3.014-.529a8.18 8.18 0 0 1-4.118-3.283c-.853-1.354-1.196-2.607-1.317-3.988-.056-.678-.046-1.345-.056-1.985-.009-.585-.027-1.141-.037-1.688-.028-.631-.065-1.225-.093-1.809-.13-2.365-.25-4.73-.222-9.46.065-9.46 1.15-9.451 1.215-18.92.065-9.461-.51-9.461-.455-18.921.065-9.46-.556-9.46-.5-18.92l.055-18.92q.056-9.46.12-18.921c.066-9.46 1.123-9.46 1.188-18.92s.297-9.46.362-18.911c.065-9.47-.316-9.47-.26-18.94.065-9.469-.232-9.478-.176-18.947.065-9.47.621-9.47.686-18.94q0-.68.028-1.28l.028-.574c.018-.297.046-.585.065-.854.194-1.771.983-3.125 1.817-3.997.844-.881 1.735-1.335 2.477-1.558.751-.223 1.363-.204 1.809-.102.908.232 1.214.779 1.335 1.345.111.584.065 1.252.093 1.975s.055 1.391.055 1.985c0 .297 0 .584.028.835 0 .074.01.139.01.102v-.028c-.01-.028.027.037.018.028 0-.01-.074-.028.019-.01.612.019 1.242.047 1.882.065 0 .093.01.177.019.27 0 .185.018.38.028.574.009.4.018.826.018 1.28z"
                  fill="currentColor"
                />
              </svg>
              <h3 className="mb-2 text-[15px] font-medium text-zinc-700">
                Looking to start a project?
              </h3>
              <p className="mb-6 max-w-[380px] text-[13.5px] leading-relaxed text-zinc-500">
                Upload materials, set custom instructions, and organize
                conversations in one space.
              </p>
              <button
                type="button"
                onClick={onNewProject}
                className={cn(appBtn.primary, "h-9 px-5 text-[13.5px]")}
              >
                New project
              </button>
            </div>
          )}

          {showGrid && (
            <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  starred={starredIds.has(project.id)}
                  onOpen={() => onOpenProject?.(project.id)}
                  onToggleStar={() => toggleStar(project.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
