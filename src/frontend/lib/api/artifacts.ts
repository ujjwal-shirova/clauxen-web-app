import { apiFetch, ApiError } from "@/frontend/lib/api/client";

const ARTIFACT_KINDS = new Set([
  "app",
  "document",
  "spreadsheet",
  "presentation",
  "image",
  "code",
  "other",
]);
const MAX_ARTIFACT_TITLE_LENGTH = 200;

function normalizeArtifactKind(kind?: string): string {
  const value = kind ?? "document";
  if (value === "template") return "other";
  return ARTIFACT_KINDS.has(value) ? value : "document";
}

export type ApiArtifact = {
  id: string;
  title: string;
  kind: string;
  status: string;
  created_at: string;
};

export async function listArtifacts() {
  return apiFetch<{ artifacts: ApiArtifact[] }>("/api/v1/artifacts");
}

export async function createArtifact(input: { title: string; kind?: string }) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new ApiError("title is required.", 400, "validation_error");
  if (title.length > MAX_ARTIFACT_TITLE_LENGTH) {
    throw new ApiError("title is too long.", 400, "validation_error");
  }
  const kind = normalizeArtifactKind(input.kind);
  return apiFetch<{ artifact: ApiArtifact }>("/api/v1/artifacts", {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify({ title, kind }),
  });
}
