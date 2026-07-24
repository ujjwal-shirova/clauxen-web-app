import { apiFetch } from "@/lib/api/client";

export type StorageSummary = {
  usedBytes: number;
  quotaBytes: number;
  categories: Array<{
    id: string;
    title: string;
    bytes: number;
    count: number;
  }>;
};

export async function getStorageSummary() {
  return apiFetch<{ storage: StorageSummary }>("/api/v1/settings/storage");
}

export type SecuritySettingsData = {
  sessions: Array<{
    id: string;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
  linkedProviders: Array<{
    id: string;
    provider: string;
    status: string;
    connectedAt: string;
  }>;
};

export async function getSecuritySettings() {
  return apiFetch<{ security: SecuritySettingsData }>(
    "/api/v1/settings/security",
  );
}

export async function requestDataExport() {
  return apiFetch<{ job: { id: string; status: string } }>(
    "/api/v1/settings/data-export",
    { method: "POST" },
  );
}

export async function listDataExports() {
  return apiFetch<{ jobs: Array<{ id: string; status: string }> }>(
    "/api/v1/settings/data-export",
  );
}

export async function requestDataDeletion() {
  return apiFetch<{ request: { id: string; status: string } }>(
    "/api/v1/settings/data-deletion",
    { method: "POST" },
  );
}

export async function listConnectedAccounts() {
  return apiFetch<{
    accounts: Array<{ id: string; provider: string; status: string }>;
    installations: Array<{ id: string; connectorName: string; status: string }>;
  }>("/api/v1/settings/connected-accounts");
}

export async function disconnectConnectedAccount(input: {
  accountId?: string;
  installationId?: string;
}) {
  return apiFetch<{ ok: boolean }>("/api/v1/settings/connected-accounts", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
