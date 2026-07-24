import { apiFetch } from "@/lib/api/client";

export type ApiResearchRun = {
  id: string;
  objective: string;
  status: string;
  processor: string;
  created_at: string;
  updated_at: string;
};

export async function listResearchRuns() {
  return apiFetch<{ runs: ApiResearchRun[] }>("/api/v1/research/runs");
}

export async function createResearchRun(input: {
  objective: string;
  processor?: string;
  chatId?: string;
}) {
  return apiFetch<{ run: ApiResearchRun }>("/api/v1/research/runs", {
    method: "POST",
    // JSON.stringify — request body serialize
    body: JSON.stringify(input),
  });
}

export async function getResearchRun(runId: string) {
  return apiFetch<{ run: ApiResearchRun }>(
    `/api/v1/research/runs/${encodeURIComponent(runId)}`,
  );
}
