import { AppError, notFound } from "@/server/db/errors";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import {
  buildImageKey,
  buildUserLibraryKey,
  deleteObject,
  moveObject,
  type StoragePurpose,
} from "@/server/storage/object-store";

const FOLDER_NAME_MAX = 120;
const FILE_NAME_MAX = 255;

function cleanName(value: string, max: number) {
  const name = value.trim().replace(/[\\/\0]/g, "-");
  if (!name || name === "." || name === "..") {
    throw new AppError("A valid name is required.", 400, "invalid_name");
  }
  if (name.length > max) {
    throw new AppError(`Name must be ${max} characters or fewer.`, 400, "invalid_name");
  }
  return name;
}

function purposeForFile(file: userFilesRepo.UserFileRow): StoragePurpose {
  return file.mime_type?.startsWith("image/") ? "images" : "documents";
}

function destinationKey(
  userId: string,
  file: userFilesRepo.UserFileRow,
  name: string,
  folderId: string | null,
) {
  return file.mime_type?.startsWith("image/")
    ? buildImageKey(userId, name, folderId)
    : buildUserLibraryKey(userId, name, folderId);
}

async function requireFolder(userId: string, folderId: string | null) {
  if (!folderId) return null;
  const folder = await userFilesRepo.getLibraryFolder(folderId, userId);
  if (!folder) throw notFound("Folder not found.");
  return folder;
}

export async function listLibrary(userId: string, folderId: string | null) {
  await requireFolder(userId, folderId);
  const [folders, files, breadcrumbs, allFolders] = await Promise.all([
    userFilesRepo.listLibraryFolders(userId, folderId),
    userFilesRepo.listUserFiles(userId, folderId),
    folderId
      ? userFilesRepo.getFolderBreadcrumbs(folderId, userId)
      : Promise.resolve([]),
    userFilesRepo.listAllLibraryFolders(userId),
  ]);
  return { folderId, folders, files, breadcrumbs, allFolders };
}

export async function createFolder(
  userId: string,
  input: { name: string; parentId?: string | null },
) {
  const parentId = input.parentId ?? null;
  await requireFolder(userId, parentId);
  const folder = await userFilesRepo.createLibraryFolder({
    userId,
    parentId,
    name: cleanName(input.name, FOLDER_NAME_MAX),
  });
  if (!folder) throw new AppError("Could not create folder.", 500);
  return folder;
}

export async function renameItem(
  userId: string,
  input: { id: string; kind: "file" | "folder"; name: string },
) {
  if (input.kind === "folder") {
    const folder = await userFilesRepo.renameLibraryFolder(
      input.id,
      userId,
      cleanName(input.name, FOLDER_NAME_MAX),
    );
    if (!folder) throw notFound("Folder not found.");
    return folder;
  }

  const file = await userFilesRepo.getUserFile(input.id, userId);
  if (!file) throw notFound("File not found.");
  const name = cleanName(input.name, FILE_NAME_MAX);
  const nextKey = destinationKey(userId, file, name, file.folder_id);
  await moveObject({
    purpose: purposeForFile(file),
    sourceKey: file.storage_path,
    destinationKey: nextKey,
    bucketOverride: file.storage_bucket,
    contentType: file.mime_type,
  });
  const updated = file.folder_id
    ? await userFilesRepo.updateLibraryFileLocation({
        fileId: file.id,
        userId,
        folderId: file.folder_id,
        originalName: name,
        storagePath: nextKey,
      })
    : await userFilesRepo.moveLibraryFileToRoot({
        fileId: file.id,
        userId,
        originalName: name,
        storagePath: nextKey,
      });
  if (!updated) throw notFound("File not found.");
  return updated;
}

export async function moveItems(
  userId: string,
  input: {
    items: Array<{ id: string; kind: "file" | "folder" }>;
    folderId: string | null;
  },
) {
  await requireFolder(userId, input.folderId);
  const moved: string[] = [];
  for (const item of input.items.slice(0, 100)) {
    if (item.kind === "folder") {
      if (item.id === input.folderId) {
        throw new AppError("A folder cannot be moved into itself.", 400);
      }
      const folder = await userFilesRepo.moveLibraryFolder(
        item.id,
        userId,
        input.folderId,
      );
      if (!folder) throw new AppError("Folder move would create a cycle.", 400);
      moved.push(item.id);
      continue;
    }

    const file = await userFilesRepo.getUserFile(item.id, userId);
    if (!file) continue;
    const nextKey = destinationKey(
      userId,
      file,
      file.original_name,
      input.folderId,
    );
    await moveObject({
      purpose: purposeForFile(file),
      sourceKey: file.storage_path,
      destinationKey: nextKey,
      bucketOverride: file.storage_bucket,
      contentType: file.mime_type,
    });
    const updated = input.folderId
      ? await userFilesRepo.updateLibraryFileLocation({
          fileId: file.id,
          userId,
          folderId: input.folderId,
          storagePath: nextKey,
        })
      : await userFilesRepo.moveLibraryFileToRoot({
          fileId: file.id,
          userId,
          storagePath: nextKey,
        });
    if (updated) moved.push(item.id);
  }
  return { moved };
}

export async function deleteItems(
  userId: string,
  items: Array<{ id: string; kind: "file" | "folder" }>,
) {
  const deleted: string[] = [];
  for (const item of items.slice(0, 100)) {
    if (item.kind === "folder") {
      const row = await userFilesRepo.deleteLibraryFolder(item.id, userId);
      if (!row) {
        throw new AppError(
          "Folders must be empty before they can be deleted.",
          409,
          "folder_not_empty",
        );
      }
      deleted.push(item.id);
      continue;
    }
    const file = await userFilesRepo.getUserFile(item.id, userId);
    if (!file) continue;
    await deleteObject(
      purposeForFile(file),
      file.storage_path,
      file.storage_bucket,
    );
    const row = await userFilesRepo.deleteUserFile(file.id, userId);
    if (row) deleted.push(file.id);
  }
  return { deleted };
}
