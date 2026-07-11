import { apiFetch } from "@/frontend/lib/api/client";

export async function presignUpload(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  projectId?: string;
  purpose?: "avatar" | "library";
}) {
  return apiFetch<{
    fileId: string;
    uploadUrl: string;
    method: string;
    stub?: boolean;
  }>("/api/v1/files/presign", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeUpload(input: {
  fileId: string;
  sizeBytes?: number;
}) {
  return apiFetch<{ file: { id: string } }>("/api/v1/files/complete", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Upload a browser File via presign → PUT → complete. */
export async function uploadUserFile(file: File) {
  const { fileId, uploadUrl, method, stub } = await presignUpload({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  if (!stub) {
    await fetch(uploadUrl, {
      method: method || "PUT",
      body: file,
      headers: {
        "content-type": file.type || "application/octet-stream",
      },
    });
  }

  await completeUpload({ fileId, sizeBytes: file.size });
  return fileId;
}
