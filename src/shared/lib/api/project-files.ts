import { apiFetch } from "@/lib/api/client";
import { uploadUserFile } from "@/lib/api/files";

export type ApiProjectFile = {
  id: string;
  project_id: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listProjectFiles(projectId: string) {
  return apiFetch<{ files: ApiProjectFile[] }>(
    `/api/projects/${encodeURIComponent(projectId)}/files`,
  );
}

export async function uploadProjectFile(projectId: string, file: File) {
  return uploadUserFile(file, { projectId });
}

export async function addProjectText(
  projectId: string,
  input: { title: string; content: string },
) {
  return apiFetch<{ file: ApiProjectFile }>(
    `/api/projects/${encodeURIComponent(projectId)}/files`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteProjectFile(projectId: string, fileId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}
