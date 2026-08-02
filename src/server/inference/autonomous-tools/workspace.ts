import path from "node:path";
import { createHash } from "node:crypto";
import {
  getOrCreateSandbox,
  listSandboxFiles,
  makeSandboxDir,
  readSandboxFile,
  readSandboxFileBytes,
  writeSandboxFile,
} from "@/server/sandbox/sandbox-manager";

export type AgentWorkspaceContext = {
  conversationId: string;
  userId?: string;
};

function safeConversationId(conversationId: string): string {
  const cleaned = conversationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleaned) return "chat";
  if (cleaned.length <= 120) return cleaned;
  // Hash long ids so distinct chats never share a truncated prefix collision.
  const digest = createHash("sha256").update(conversationId).digest("hex").slice(0, 16);
  return `${cleaned.slice(0, 100)}_${digest}`;
}

export function sandboxWorkspaceDir(conversationId: string): string {
  return `/workspace/clauxen/${safeConversationId(conversationId)}`;
}

/**
 * Resolve a model-supplied path into the conversation workspace.
 *
 * Absolute paths already under the workspace root are kept.
 * Absolute paths outside the workspace are remapped under `outputs/`
 * by basename so bash `/tmp/report.pdf` still publishes correctly —
 * callers that need the original absolute location use
 * `resolveSandboxReadablePath`.
 */
export function resolveSandboxWorkspacePath(
  conversationId: string,
  filePath: string,
): string {
  const root = sandboxWorkspaceDir(conversationId);
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!normalized) {
    return path.posix.join(root, "untitled.txt");
  }
  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }
  if (normalized.startsWith("/")) {
    // Absolute outside workspace → stage under outputs/ by basename.
    const base = path.posix.basename(normalized) || "untitled.txt";
    return path.posix.join(root, "outputs", base);
  }
  const relative = normalized.replace(/^\/+/, "") || "untitled.txt";
  const resolved = path.posix.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new Error(
      `Path escapes conversation workspace. Write deliverables under ${root}/outputs/.`,
    );
  }
  return resolved;
}

/**
 * Resolve a path for reading sandbox output. Prefers the workspace mapping,
 * but also tries the original absolute path when the model wrote outside
 * the conversation root (common with /tmp or /home/user).
 */
export function resolveSandboxReadableCandidates(
  conversationId: string,
  filePath: string,
): string[] {
  const root = sandboxWorkspaceDir(conversationId);
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!normalized) return [path.posix.join(root, "untitled.txt")];

  const candidates: string[] = [];
  if (normalized === root || normalized.startsWith(`${root}/`)) {
    candidates.push(normalized);
  } else if (normalized.startsWith("/")) {
    candidates.push(normalized);
    candidates.push(resolveSandboxWorkspacePath(conversationId, normalized));
  } else {
    candidates.push(resolveSandboxWorkspacePath(conversationId, normalized));
  }
  return Array.from(new Set(candidates));
}

/** Display / artifact path relative to the workspace root (no leading slash). */
export function toWorkspaceRelativePath(
  conversationId: string,
  absoluteOrRelative: string,
): string {
  const root = sandboxWorkspaceDir(conversationId);
  const normalized = absoluteOrRelative.replace(/\\/g, "/").trim();
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  if (normalized === root) return ".";
  if (normalized.startsWith("/")) {
    return path.posix.join("outputs", path.posix.basename(normalized) || "untitled.txt");
  }
  return normalized.replace(/^\/+/, "") || "untitled.txt";
}

export async function ensureSandboxWorkspace(
  ctx: AgentWorkspaceContext,
): Promise<{ sandboxId: string; root: string }> {
  const { sandbox, info } = await getOrCreateSandbox(ctx);
  const root = sandboxWorkspaceDir(ctx.conversationId);
  await sandbox.files.makeDir("/workspace/clauxen");
  await sandbox.files.makeDir(root);
  await sandbox.files.makeDir(`${root}/outputs`);
  return { sandboxId: info.sandboxId, root };
}

export async function readScopedFile(
  ctx: AgentWorkspaceContext,
  filePath: string,
): Promise<{ path: string; content: string }> {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const candidates = resolveSandboxReadableCandidates(ctx.conversationId, filePath);
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const content = await readSandboxFile(sandboxId, candidate);
      return {
        path: toWorkspaceRelativePath(ctx.conversationId, candidate),
        content,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not read ${filePath}`);
}

export async function readScopedFileBytes(
  ctx: AgentWorkspaceContext,
  filePath: string,
): Promise<{ path: string; bytes: Uint8Array; absolutePath: string }> {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const candidates = resolveSandboxReadableCandidates(ctx.conversationId, filePath);
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const bytes = await readSandboxFileBytes(sandboxId, candidate);
      return {
        path: toWorkspaceRelativePath(ctx.conversationId, candidate),
        bytes,
        absolutePath: candidate,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not read ${filePath}`);
}

export async function writeScopedFile(
  ctx: AgentWorkspaceContext,
  filePath: string,
  content: string,
): Promise<{ path: string; bytesWritten: number; content: string }> {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const relative = toWorkspaceRelativePath(ctx.conversationId, filePath);
  const resolved = resolveSandboxWorkspacePath(ctx.conversationId, relative);
  await makeSandboxDir(sandboxId, path.posix.dirname(resolved));
  await writeSandboxFile(sandboxId, resolved, content);
  return {
    path: relative,
    bytesWritten: Buffer.byteLength(content, "utf8"),
    content,
  };
}

export async function listScopedFiles(
  ctx: AgentWorkspaceContext,
  dirPath = ".",
) {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const resolved = resolveSandboxWorkspacePath(ctx.conversationId, dirPath);
  return listSandboxFiles(sandboxId, resolved);
}
