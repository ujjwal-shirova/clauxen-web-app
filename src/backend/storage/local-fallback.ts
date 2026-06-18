import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const ROOT =
  process.env.STORAGE_LOCAL_PATH ??
  path.join(process.cwd(), "storage", "r2-fallback");

async function objectPath(bucket: string, key: string) {
  const full = path.join(ROOT, bucket, key);
  await mkdir(path.dirname(full), { recursive: true });
  return full;
}

export async function writeLocalObject(
  bucket: string,
  key: string,
  body: Buffer,
) {
  const full = await objectPath(bucket, key);
  await writeFile(full, body);
}

export async function readLocalObject(bucket: string, key: string) {
  const full = path.join(ROOT, bucket, key);
  return readFile(full);
}

export async function deleteLocalObject(bucket: string, key: string) {
  const full = path.join(ROOT, bucket, key);
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
}
