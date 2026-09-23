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
  notification_mode: AutomationNotificationMode;
  model_mode: AutomationModelMode;
  skill_ids: string[];
  attachment_refs: Array<Record<string, unknown>>;
};

export type AutomationNotificationMode =
  | "email_app"
  | "email_only"
  | "app_only"
  | "off";
export type AutomationModelMode = "fast" | "thinking";

export type AutomationInput = {
  name: string;
  requirement: string;
  frequency: AutomationFrequency;
  timeLocal: string;
  timezone: string;
  runDate?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  notificationMode?: AutomationNotificationMode;
  modelMode?: AutomationModelMode;
  skillIds?: string[];
  attachmentRefs?: Array<Record<string, unknown>>;
};

export type ApiAutomationRun = {
  id: string;
  task_id: string;
  task_name: string;
  chat_id: string | null;
  status: "queued" | "running" | "success" | "failed" | "skipped";
  queued_at: string;
  started_at: string;
  finished_at: string | null;
  scheduled_for: string;
  attempt_count: number;
  summary: string | null;
  error_message: string | null;
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

export function listAutomationRuns(limit = 50) {
  return apiFetch<{ runs: ApiAutomationRun[] }>(
    `/api/v1/scheduled-tasks/runs?limit=${limit}`,
  );
}
