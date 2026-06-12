/** Client-side project extras until dedicated API fields exist. */

const INSTRUCTIONS_PREFIX = "clauxen-project-instructions:";
const FILES_PREFIX = "clauxen-project-files:";

export type ProjectFileKind = "upload" | "text" | "github";

export type ProjectFileMeta = {
  id: string;
  name: string;
  addedAt: string;
  /** Present for user-pasted text content (frontend-only until API). */
  content?: string;
  kind?: ProjectFileKind;
  /** Secondary line — branch name, line count, extension label, etc. */
  subtitle?: string;
  /** Share of project knowledge capacity (0–100). */
  capacityPercent?: number;
  /** Full repo path when imported from GitHub. */
  githubRepo?: string;
};

export const PROJECT_CAPACITY_MAX = 100;

/** Rough capacity share for a file when not explicitly set. */
export function estimateFileCapacity(file: ProjectFileMeta): number {
  if (file.capacityPercent != null) return file.capacityPercent;
  if (file.kind === "github") return 12;
  if (file.content) {
    return Math.min(28, Math.max(2, Math.ceil(file.content.length / 400)));
  }
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : "";
  if (ext === "json" || ext === "ipynb") return 18;
  if (ext === "md") return 8;
  return Math.min(15, Math.max(2, Math.ceil(file.name.length / 8)));
}

export function getProjectCapacityUsed(files: ProjectFileMeta[]): number {
  const total = files.reduce((sum, f) => sum + estimateFileCapacity(f), 0);
  return Math.min(PROJECT_CAPACITY_MAX, Math.round(total));
}

export function wouldExceedCapacity(
  files: ProjectFileMeta[],
  incoming: ProjectFileMeta[],
): boolean {
  const current = getProjectCapacityUsed(files);
  const added = incoming.reduce((sum, f) => sum + estimateFileCapacity(f), 0);
  return current + added > PROJECT_CAPACITY_MAX;
}

export function getProjectInstructions(projectId: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(`${INSTRUCTIONS_PREFIX}${projectId}`) ?? "";
  } catch {
    return "";
  }
}

export function setProjectInstructions(projectId: string, text: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${INSTRUCTIONS_PREFIX}${projectId}`, text);
  } catch {
    /* ignore quota */
  }
}

export function getProjectFiles(projectId: string): ProjectFileMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${FILES_PREFIX}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectFileMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setProjectFiles(projectId: string, files: ProjectFileMeta[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${FILES_PREFIX}${projectId}`, JSON.stringify(files));
  } catch {
    /* ignore */
  }
}
