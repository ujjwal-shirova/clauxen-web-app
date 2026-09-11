import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/utils/supabase/client";

export async function presignUpload(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  projectId?: string;
  folderId?: string | null;
  purpose?: "avatar" | "library" | "chat-attachment";
  chatId?: string | null;
}) {
  return apiFetch<{
    fileId: string;
    uploadUrl: string;
    method: string;
    stub?: boolean;
    worker?: boolean;
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
export async function uploadUserFile(
  file: File,
  options?: {
    folderId?: string | null;
    projectId?: string;
    purpose?: "avatar" | "library" | "chat-attachment";
    chatId?: string | null;
  },
) {
  const { fileId, uploadUrl, method, stub, worker } = await presignUpload({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    folderId: options?.folderId,
    projectId: options?.projectId,
    purpose: options?.purpose,
    chatId: options?.chatId,
  });

  if (!stub) {
    const headers: Record<string, string> = {
      "content-type": file.type || "application/octet-stream",
    };
    // Worker gateway authenticates PUTs with the Supabase access token.
    if (worker) {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
    const putResponse = await fetch(uploadUrl, {
      method: method || "PUT",
      body: file,
      headers,
    });
    if (!putResponse.ok) {
      throw new Error(`Upload failed (${putResponse.status})`);
    }
  }

  await completeUpload({ fileId, sizeBytes: file.size });
  return fileId;
}
