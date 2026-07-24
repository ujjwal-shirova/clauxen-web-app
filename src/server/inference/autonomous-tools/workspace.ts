import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * On Vercel the deployment filesystem is read-only except /tmp.
 * Locally we keep a project-relative workspace for easier debugging.
 */
function resolveWorkspaceRoot(): string {
  const configured = process.env.AUTONOMOUS_AGENT_FILE_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
  }
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "clauxen-agent-files");
  }
  return path.join(process.cwd(), ".autonomous-agent-files");
}

const FILE_WORKSPACE_ROOT = resolveWorkspaceRoot();

function workspaceDir(conversationId: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return path.join(FILE_WORKSPACE_ROOT, safeId || "chat");
}

function resolveScopedPath(conversationId: string, filePath: string): string {
  const base = workspaceDir(conversationId);
  const cleaned = filePath.replace(/^\/+/, "").trim() || "untitled.txt";
  const resolved = path.resolve(base, cleaned);
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
  return { path: filePath.replace(/^\/+/, ""), content };
}

export async function writeScopedFile(
  conversationId: string,
  filePath: string,
  content: string,
): Promise<{ path: string; bytesWritten: number; content: string }> {
  await ensureWorkspace(conversationId);
  const relative = filePath.replace(/^\/+/, "").trim() || "untitled.txt";
  const resolved = resolveScopedPath(conversationId, relative);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, content, "utf8");
  return {
    path: relative,
    bytesWritten: Buffer.byteLength(content, "utf8"),
    content,
  };
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
