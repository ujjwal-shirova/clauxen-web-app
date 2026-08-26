import { apiFetch } from "@/lib/api/client";

export type AutomationFrequency = "once" | "daily" | "weekly" | "monthly";

export type ApiAutomation = {
  id: string;
  name: string;
  requirement: string;
  frequency: AutomationFrequency;
  time_local: string;
  timezone: string;
  run_date: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  status: "active" | "paused" | "completed" | string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  run_count: number;
};

export type AutomationInput = {
  name: string;
  requirement: string;
  frequency: AutomationFrequency;
  timeLocal: string;
  timezone: string;
  runDate?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
};

export function listAutomations() {
  return apiFetch<{ tasks: ApiAutomation[] }>("/api/v1/scheduled-tasks");
}

export function createAutomation(input: AutomationInput) {
  return apiFetch<{ task: ApiAutomation }>("/api/v1/scheduled-tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAutomation(
  taskId: string,
  input: Partial<AutomationInput> & { status?: "active" | "paused" },
) {
  return apiFetch<{ task: ApiAutomation }>(
    `/api/v1/scheduled-tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteAutomation(taskId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/v1/scheduled-tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}
