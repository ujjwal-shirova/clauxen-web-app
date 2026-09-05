"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as projectsApi from "@/lib/api/projects";
import type { ApiProject } from "@/lib/api/projects";
import { readPinnedProjectIds, setProjectPinned } from "@/lib/pinned-projects";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from "@/lib/project-limits";
const API_PROJECTS_CACHE_KEY = "clauxen-api-projects-cache";
const PROJECTS_UPDATED_EVENT = "clauxen:projects-updated";
const LIST_DEDUP_TTL_MS = 5_000;

type ApiProjectsCache = {
  savedAt: number;
  projects: ApiProject[];
};

/** Shared across every useProjects() mount so boot doesn't triple-fetch. */
let apiListInflight: Promise<ApiProject[]> | null = null;
let apiListCached: ApiProjectsCache | null = null;

function loadCachedApiProjects(): ApiProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(API_PROJECTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApiProjectsCache;
    if (!Array.isArray(parsed?.projects)) return [];
    apiListCached = {
      savedAt: parsed.savedAt || Date.now(),
      projects: parsed.projects,
    };
    return parsed.projects;
  } catch {
    return [];
  }
}

function saveCachedApiProjects(rows: ApiProject[]) {
  if (typeof window === "undefined") return;
  const payload: ApiProjectsCache = { savedAt: Date.now(), projects: rows };
  apiListCached = payload;
  try {
    localStorage.setItem(API_PROJECTS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

function publishProjects(rows: ApiProject[]) {
  saveCachedApiProjects(rows);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
  }
}

async function listProjectsSingleflight(): Promise<ApiProject[]> {
  if (apiListCached && Date.now() - apiListCached.savedAt < LIST_DEDUP_TTL_MS) {
    return apiListCached.projects;
  }
  if (apiListInflight) return apiListInflight;
  apiListInflight = (async () => {
    try {
      const { projects: rows } = await projectsApi.listProjects();
      saveCachedApiProjects(rows);
      return rows;
    } finally {
      apiListInflight = null;
    }
  })();
  return apiListInflight;
}

export function useProjects(apiEnabled: boolean) {
  const [projects, setProjects] = useState<ApiProject[]>(() =>
    apiEnabled ? loadCachedApiProjects() : [],
  );
  const [loading, setLoading] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const hasPaint =
      (apiListCached?.projects.length ?? loadCachedApiProjects().length) > 0;
    if (!hasPaint) setLoading(true);
    try {
      if (apiEnabled) {
        const rows = await listProjectsSingleflight();
        setProjects(rows);
      } else setProjects([]);
    } catch {
      setProjects(loadCachedApiProjects());
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // MainLayout, sidebar and project routes each use this hook. Keep those
  // independent mounts in sync immediately after a create/edit/delete.
  useEffect(() => {
    const sync = () => setProjects(loadCachedApiProjects());
    window.addEventListener(PROJECTS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PROJECTS_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    setPinnedIds(readPinnedProjectIds());
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "clauxen-pinned-project-ids") return;
      setPinnedIds(readPinnedProjectIds());
    };
    const onCustom = () => setPinnedIds(readPinnedProjectIds());
    window.addEventListener("storage", onStorage);
    window.addEventListener("clauxen-pinned-projects-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("clauxen-pinned-projects-changed", onCustom);
    };
  }, []);

  const createProject = useCallback(
    async (input: {
      id?: string;
      name: string;
      description?: string;
      icon?: string;
      color?: string;
    }) => {
      const trimmed = input.name.trim().slice(0, PROJECT_NAME_MAX_LENGTH);
      if (!trimmed) return;
      const description = input.description
        ?.trim()
        .slice(0, PROJECT_DESCRIPTION_MAX_LENGTH);

      if (!apiEnabled) {
        throw new Error("Sign in before creating a project.");
      }

      const id =
        input.id ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);
      const now = new Date().toISOString();
      const optimistic: ApiProject = {
        id,
        name: trimmed,
        description: description || null,
        system_prompt: null,
        icon: input.icon ?? null,
        color: input.color ?? null,
        created_at: now,
        updated_at: now,
      };
      setProjects((prev) => [
        optimistic,
        ...prev.filter((p) => p.id !== id),
      ]);
      publishProjects([
        optimistic,
        ...loadCachedApiProjects().filter((p) => p.id !== id),
      ]);

      try {
        const { project } = await projectsApi.createProject({
          id,
          name: trimmed,
          description: description || undefined,
          icon: input.icon,
          color: input.color,
        });
        setProjects((prev) => [
          project,
          ...prev.filter((p) => p.id !== project.id),
        ]);
        publishProjects([
          project,
          ...loadCachedApiProjects().filter((p) => p.id !== project.id),
        ]);
        return project;
      } catch (error) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        publishProjects(loadCachedApiProjects().filter((p) => p.id !== id));
        throw error;
      }
    },
    [apiEnabled],
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      patch: {
        name?: string;
        description?: string;
        system_prompt?: string;
        icon?: string;
        color?: string;
      },
    ) => {
      if (!apiEnabled) throw new Error("Sign in before updating a project.");
      const nextPatch = {
        ...patch,
        ...(patch.name !== undefined
          ? { name: patch.name.trim().slice(0, PROJECT_NAME_MAX_LENGTH) }
          : {}),
        ...(patch.description !== undefined
          ? {
              description: patch.description
                .trim()
                .slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
            }
          : {}),
      };
      if (patch.name !== undefined && !nextPatch.name) {
        throw new Error("Project name cannot be empty.");
      }
      const { project } = await projectsApi.updateProject(projectId, nextPatch);
      const next = loadCachedApiProjects().map((p) =>
        p.id === projectId ? project : p,
      );
      setProjects(next);
      publishProjects(next);
      return project;
    },
    [apiEnabled],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      // Optimistic: remove from UI immediately, then persist.
      const previous = projects;
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (pinnedIds.includes(projectId)) {
        setPinnedIds(setProjectPinned(projectId, false));
      }

      if (!apiEnabled) {
        setProjects(previous);
        return false;
      }
      try {
        await projectsApi.deleteProject(projectId);
        publishProjects(previous.filter((p) => p.id !== projectId));
        return true;
      } catch {
        setProjects(previous);
        return false;
      }
    },
    [apiEnabled, pinnedIds, projects],
  );

  const pinProject = useCallback((projectId: string, pinned: boolean) => {
    setPinnedIds(setProjectPinned(projectId, pinned));
  }, []);

  const pinnedProjects = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((p): p is ApiProject => Boolean(p));
  }, [projects, pinnedIds]);

  const unpinnedProjects = useMemo(() => {
    const pinned = new Set(pinnedIds);
    return projects.filter((p) => !pinned.has(p.id));
  }, [projects, pinnedIds]);

  return {
    projects,
    pinnedProjects,
    unpinnedProjects,
    pinnedIds,
    loading,
    refresh,
    createProject,
    updateProject,
    deleteProject,
    pinProject,
  };
}
