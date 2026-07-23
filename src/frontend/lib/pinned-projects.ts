/**
 * Client-persisted pinned project ids (ordered).
 * Survives reloads; syncs across tabs via storage events.
 */

const STORAGE_KEY = "clauxen-pinned-project-ids";

export function readPinnedProjectIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function writePinnedProjectIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(
      new CustomEvent("clauxen-pinned-projects-changed", { detail: ids }),
    );
  } catch {
    /* ignore quota */
  }
}

export function isProjectPinned(projectId: string, ids = readPinnedProjectIds()) {
  return ids.includes(projectId);
}

export function setProjectPinned(projectId: string, pinned: boolean): string[] {
  const prev = readPinnedProjectIds();
  const next = pinned
    ? [projectId, ...prev.filter((id) => id !== projectId)]
    : prev.filter((id) => id !== projectId);
  writePinnedProjectIds(next);
  return next;
}
