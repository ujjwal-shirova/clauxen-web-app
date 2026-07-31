import { apiFetch } from "@/lib/api/client";

export type LibraryFolder = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export type LibraryFile = {
  id: string;
  folder_id: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LibraryEntryRef = { id: string; kind: "file" | "folder" };

export type LibraryListing = {
  folderId: string | null;
  folders: LibraryFolder[];
  files: LibraryFile[];
  breadcrumbs: LibraryFolder[];
  allFolders: LibraryFolder[];
};

export function getLibrary(folderId?: string | null) {
  const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
  return apiFetch<LibraryListing>(`/api/v1/library${query}`);
}

export function createLibraryFolder(input: {
  name: string;
  parentId?: string | null;
}) {
  return apiFetch<{ folder: LibraryFolder }>("/api/v1/library", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function renameLibraryEntry(input: LibraryEntryRef & { name: string }) {
  return apiFetch<{ item: LibraryFolder | LibraryFile }>("/api/v1/library", {
    method: "PATCH",
    body: JSON.stringify({ action: "rename", ...input }),
  });
}

export function moveLibraryEntries(
  items: LibraryEntryRef[],
  folderId: string | null,
) {
  return apiFetch<{ moved: string[] }>("/api/v1/library", {
    method: "PATCH",
    body: JSON.stringify({ action: "move", items, folderId }),
  });
}

export function deleteLibraryEntries(items: LibraryEntryRef[]) {
  return apiFetch<{ deleted: string[] }>("/api/v1/library", {
    method: "DELETE",
    body: JSON.stringify({ items }),
  });
}
