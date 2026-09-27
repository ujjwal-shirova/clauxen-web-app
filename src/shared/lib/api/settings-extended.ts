import { apiFetch } from "@/lib/api/client";

export type StoragePurchase = {
  id: string;
  gigabytes: number;
  amountPaise: number;
  amountUsdMicros: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

export type StorageSummary = {
  usedBytes: number;
  quotaBytes: number;
  includedBytes: number;
  includedGb: number;
  extraGb: number;
  planId: string;
  tier: string;
  priceUsdPerGb: number;
  usdInrRate: number;
  categories: Array<{
    id: string;
    title: string;
    bytes: number;
    count: number;
  }>;
  purchases: StoragePurchase[];
};

export async function getStorageSummary() {
  return apiFetch<{ storage: StorageSummary }>("/api/v1/settings/storage");
}

export type StorageCheckout = {
  id: string;
  gigabytes: number;
  amountPaise: number;
  amountUsdMicros: number;
  currency: "INR";
  keyId: string;
  orderId: string;
  priceUsdPerGb: number;
};

export async function startStoragePurchase(gigabytes: number) {
  return apiFetch<{ purchase: StorageCheckout }>(
    "/api/v1/settings/storage/purchase",
    {
      method: "POST",
      body: JSON.stringify({ gigabytes }),
    },
  );
}

export async function verifyStoragePurchase(input: {
  purchaseId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return apiFetch<{
    status: "paid";
    extraGb: number;
    gigabytes: number;
  }>("/api/v1/settings/storage/purchase/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type SecuritySettingsData = {
  sessions: Array<{
    id: string;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
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
