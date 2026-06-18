import {
  listScopedFiles,
  readScopedFile,
  writeScopedFile,
} from "@/autonomous-agent/server/store/file-store";

export async function runFileRead(conversationId: string, filePath: string) {
  return readScopedFile(conversationId, filePath);
}

export async function runFileWrite(
  conversationId: string,
  filePath: string,
  content: string,
) {
  return writeScopedFile(conversationId, filePath, content);
}

export async function runFileList(conversationId: string, dirPath?: string) {
  const files = await listScopedFiles(conversationId, dirPath ?? ".");
  return { files };
}
