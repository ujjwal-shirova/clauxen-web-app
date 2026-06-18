import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE_WORKSPACE_ROOT =
  process.env.AUTONOMOUS_AGENT_FILE_ROOT?.trim() || ".autonomous-agent-files";

function workspaceDir(conversationId: string): string {
  return path.join(process.cwd(), FILE_WORKSPACE_ROOT, conversationId);
}

function resolveScopedPath(conversationId: string, filePath: string): string {
  const base = workspaceDir(conversationId);
  const resolved = path.resolve(base, filePath);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error("Path escapes conversation workspace");
  }
  return resolved;
}

export async function ensureWorkspace(conversationId: string): Promise<string> {
  const dir = workspaceDir(conversationId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function readScopedFile(
  conversationId: string,
  filePath: string,
): Promise<{ path: string; content: string }> {
  await ensureWorkspace(conversationId);
  const resolved = resolveScopedPath(conversationId, filePath);
  const content = await readFile(resolved, "utf8");
  return { path: filePath, content };
}

export async function writeScopedFile(
  conversationId: string,
  filePath: string,
  content: string,
): Promise<{ path: string; bytesWritten: number }> {
  await ensureWorkspace(conversationId);
  const resolved = resolveScopedPath(conversationId, filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, content, "utf8");
  return { path: filePath, bytesWritten: Buffer.byteLength(content, "utf8") };
}

export async function listScopedFiles(
  conversationId: string,
  dirPath = ".",
): Promise<string[]> {
  await ensureWorkspace(conversationId);
  const resolved = resolveScopedPath(conversationId, dirPath);
  const entries = await readdir(resolved, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}
