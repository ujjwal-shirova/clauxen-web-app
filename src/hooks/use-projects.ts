"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as projectsApi from "@/lib/api/projects";
import type { ApiProject } from "@/lib/api/projects";
import {
  readPinnedProjectIds,
  setProjectPinned,
} from "@/lib/pinned-projects";

const MAX_PROJECT_NAME_LENGTH = 200;
const LOCAL_PROJECTS_KEY = "clauxen-local-projects";
const API_PROJECTS_CACHE_KEY = "clauxen-api-projects-cache";
const LIST_DEDUP_TTL_MS = 5_000;

type ApiProjectsCache = {
  savedAt: number;
  projects: ApiProject[];
};

/** Shared across every useProjects() mount so boot doesn't triple-fetch. */
let apiListInflight: Promise<ApiProject[]> | null = null;
let apiListCached: ApiProjectsCache | null = null;

function loadLocalProjects(): ApiProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApiProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalProjects(rows: ApiProject[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

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

async function listProjectsSingleflight(): Promise<ApiProject[]> {
  if (
    apiListCached &&
    Date.now() - apiListCached.savedAt < LIST_DEDUP_TTL_MS
  ) {
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

function createLocalProject(input: {
  name: string;
  description?: string;
}): ApiProject {
  const now = new Date().toISOString();
  return {
    id: `local-${crypto.randomUUID()}`,
    name: input.name,
    description: input.description ?? null,
    color: null,
    created_at: now,
    updated_at: now,
  };
}

export function useProjects(apiEnabled: boolean) {
  const [projects, setProjects] = useState<ApiProject[]>(() =>
    apiEnabled ? loadCachedApiProjects() : loadLocalProjects(),
  );
  const [loading, setLoading] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const hasPaint =
      (apiEnabled
        ? (apiListCached?.projects.length ?? loadCachedApiProjects().length)
        : loadLocalProjects().length) > 0;
    if (!hasPaint) setLoading(true);
    try {
      if (apiEnabled) {
        const rows = await listProjectsSingleflight();
        setProjects(rows);
      } else {
        setProjects(loadLocalProjects());
      }
    } catch {
      setProjects(apiEnabled ? loadCachedApiProjects() : []);
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    async (input: { name: string; description?: string }) => {
      const trimmed = input.name.trim();
      if (!trimmed || trimmed.length > MAX_PROJECT_NAME_LENGTH) return;

      if (apiEnabled) {
        try {
          const { project } = await projectsApi.createProject({
            name: trimmed,
            description: input.description?.trim() || undefined,
          });
          setProjects((prev) => [project, ...prev]);
          return project;
        } catch {
          /* fall through to local save */
        }
      }

      const project = createLocalProject({
        name: trimmed,
        description: input.description?.trim() || undefined,
      });
      const next = [project, ...loadLocalProjects()];
      saveLocalProjects(next);
      setProjects(next);
      return project;
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
      },
    ) => {
      if (apiEnabled && !projectId.startsWith("local-")) {
        try {
          const { project } = await projectsApi.updateProject(projectId, patch);
          setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? project : p)),
          );
          return project;
        } catch {
          return undefined;
        }
      }

      const next = loadLocalProjects().map((p) =>
        p.id === projectId
          ? {
              ...p,
              name: patch.name ?? p.name,
              description:
                patch.description !== undefined
                  ? patch.description || null
                  : p.description,
              updated_at: new Date().toISOString(),
            }
          : p,
      );
      saveLocalProjects(next);
      setProjects(next);
      return next.find((p) => p.id === projectId);
    },
    [apiEnabled],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (apiEnabled && !projectId.startsWith("local-")) {
        try {
          await projectsApi.deleteProject(projectId);
        } catch {
          return false;
        }
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        return true;
      }

      const next = loadLocalProjects().filter((p) => p.id !== projectId);
      saveLocalProjects(next);
      setProjects(next);
      return true;
    },
    [apiEnabled],
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
