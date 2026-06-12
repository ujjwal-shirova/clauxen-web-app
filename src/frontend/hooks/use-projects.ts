"use client";

import { useCallback, useEffect, useState } from "react";
import * as projectsApi from "@/frontend/lib/api/projects";
import type { ApiProject } from "@/frontend/lib/api/projects";

const MAX_PROJECT_NAME_LENGTH = 200;
const LOCAL_PROJECTS_KEY = "clauxen-local-projects";

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
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (apiEnabled) {
        const { projects: rows } = await projectsApi.listProjects();
        setProjects(rows);
      } else {
        setProjects(loadLocalProjects());
      }
    } catch {
      setProjects(apiEnabled ? loadLocalProjects() : []);
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      patch: { name?: string; description?: string },
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

  return { projects, loading, refresh, createProject, updateProject };
}
