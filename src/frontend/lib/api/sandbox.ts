import { apiFetch } from "@/frontend/lib/api/client";

export type SandboxInfo = {
  sandboxId: string;
  templateId?: string;
  name?: string;
  metadata: Record<string, string>;
  startedAt?: string;
  endAt?: string;
  state?: string;
  cpuCount?: number;
  memoryMB?: number;
};

export async function listSandboxes(state?: string) {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return apiFetch<{ sandboxes: SandboxInfo[] }>(`/api/v1/sandbox${query}`);
}

export async function createSandbox(payload?: {
  timeoutMs?: number;
  autoPause?: boolean;
  autoResume?: boolean;
  idleTimeoutSeconds?: number;
  conversationId?: string;
  metadata?: Record<string, string>;
}) {
  return apiFetch<SandboxInfo>("/api/v1/sandbox", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function getSandbox(sandboxId: string) {
  return apiFetch<SandboxInfo>(`/api/v1/sandbox/${sandboxId}`);
}

export async function killSandbox(sandboxId: string) {
  return apiFetch<{ sandboxId: string; killed: boolean }>(
    `/api/v1/sandbox/${sandboxId}`,
    { method: "DELETE" },
  );
}

export async function pauseSandbox(sandboxId: string) {
  return apiFetch<{ sandboxId: string; paused: boolean }>(
    `/api/v1/sandbox/${sandboxId}/pause`,
    { method: "POST" },
  );
}

export async function connectSandbox(
  sandboxId: string,
  timeoutMs?: number,
) {
  return apiFetch<SandboxInfo>(`/api/v1/sandbox/${sandboxId}/connect`, {
    method: "POST",
    body: JSON.stringify({ timeoutMs }),
  });
}

export async function setSandboxTimeout(
  sandboxId: string,
  timeoutMs: number,
) {
  return apiFetch<{ sandboxId: string; timeoutMs: number }>(
    `/api/v1/sandbox/${sandboxId}/timeout`,
    {
      method: "PATCH",
      body: JSON.stringify({ timeoutMs }),
    },
  );
}

export async function getSandboxMetrics(sandboxId: string) {
  return apiFetch<{ metrics: unknown[] }>(
    `/api/v1/sandbox/${sandboxId}/metrics`,
  );
}

export async function runSandboxCommand(
  sandboxId: string,
  payload: {
    command: string;
    background?: boolean;
    cwd?: string;
    timeoutMs?: number;
  },
) {
  return apiFetch<unknown>(`/api/v1/sandbox/${sandboxId}/commands`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function readSandboxFile(sandboxId: string, path: string) {
  return apiFetch<{ path: string; content: string }>(
    `/api/v1/sandbox/${sandboxId}/files`,
    {
      method: "PUT",
      body: JSON.stringify({ path }),
    },
  );
}

export async function writeSandboxFile(
  sandboxId: string,
  path: string,
  content: string,
) {
  return apiFetch<unknown>(`/api/v1/sandbox/${sandboxId}/files`, {
    method: "POST",
    body: JSON.stringify({ path, content }),
  });
}

export async function getSandboxHost(sandboxId: string, port: number) {
  return apiFetch<{ host: string; url: string; port: number }>(
    `/api/v1/sandbox/${sandboxId}/host?port=${port}`,
  );
}
