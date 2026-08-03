import { mkdir, writeFile, readFile, unlink, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT =
  process.env.STORAGE_LOCAL_PATH ??
  path.join(process.cwd(), "storage", "uploads");

export async function ensureStorageDir(projectId: string) {
  const dir = path.join(STORAGE_ROOT, projectId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveProjectFile(
  projectId: string,
  filename: string,
  buffer: Buffer,
) {
  const dir = await ensureStorageDir(projectId);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = path.join(dir, `${randomUUID()}-${safeName}`);
  await writeFile(storagePath, buffer);
  return storagePath;
}

export async function readProjectFile(storagePath: string) {
  return readFile(storagePath);
}

export async function deleteProjectFile(storagePath: string) {
  try {
    await unlink(storagePath);
  } catch {
    /* ignore missing */
  }
}

export async function deleteProjectDir(projectId: string) {
  const dir = path.join(STORAGE_ROOT, projectId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}
