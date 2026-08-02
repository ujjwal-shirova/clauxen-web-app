import path from "node:path";
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
  return conversationId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "chat";
}

export function sandboxWorkspaceDir(conversationId: string): string {
  return `/workspace/clauxen/${safeConversationId(conversationId)}`;
}

export function resolveSandboxWorkspacePath(
  conversationId: string,
  filePath: string,
): string {
  const root = sandboxWorkspaceDir(conversationId);
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (normalized === root || normalized.startsWith(`${root}/`)) {
    return normalized;
  }
  const cleaned = normalized.replace(/^\/+/, "");
  const relative = cleaned || "untitled.txt";
  const resolved = path.posix.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    throw new Error("Path escapes conversation workspace");
  }
  return resolved;
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
  const resolved = resolveSandboxWorkspacePath(ctx.conversationId, filePath);
  const content = await readSandboxFile(sandboxId, resolved);
  return { path: filePath.replace(/^\/+/, ""), content };
}

export async function readScopedFileBytes(
  ctx: AgentWorkspaceContext,
  filePath: string,
): Promise<{ path: string; bytes: Uint8Array }> {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const resolved = resolveSandboxWorkspacePath(ctx.conversationId, filePath);
  const bytes = await readSandboxFileBytes(sandboxId, resolved);
  return { path: filePath.replace(/^\/+/, ""), bytes };
}

export async function writeScopedFile(
  ctx: AgentWorkspaceContext,
  filePath: string,
  content: string,
): Promise<{ path: string; bytesWritten: number; content: string }> {
  const { sandboxId } = await ensureSandboxWorkspace(ctx);
  const relative = filePath.replace(/^\/+/, "").trim() || "untitled.txt";
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
