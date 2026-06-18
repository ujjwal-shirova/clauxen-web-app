import { randomUUID } from "node:crypto";
import { query, queryOne } from "@/backend/db/pool";
import { chunkText } from "@/projects/lib/chunking";
import { embedText } from "@/projects/lib/embeddings";
import { getObject } from "@/backend/storage/object-store";
import { extractTextFromBuffer } from "@/backend/services/text-extract.service";

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveProjectContext(projectId: string, queryText: string) {
  const queryVector = await embedText(queryText);
  const rows = await query<{
    content: string;
    embedding: number[] | null;
  }>(
    `select content, embedding
     from public.document_chunks
     where project_id = $1::uuid and embedding is not null`,
    [projectId],
  );

  return rows
    .map((row) => ({
      content: row.content,
      similarity: row.embedding
        ? cosineSimilarity(queryVector, row.embedding)
        : 0,
    }))
    .filter((r) => r.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
}

export async function processProjectFile(fileId: string) {
  const file = await queryOne<{
    id: string;
    project_id: string;
    user_id: string;
    filename: string;
    file_type: string;
    storage_bucket: string;
    storage_path: string;
  }>(
    `select id, project_id, user_id, filename, file_type, storage_bucket, storage_path
     from public.project_files where id = $1`,
    [fileId],
  );
  if (!file) return;

  try {
    const buffer = await getObject(
      "documents",
      file.storage_path,
      file.storage_bucket,
    );
    const text = await extractTextFromBuffer(buffer, file.filename);
    const chunks = chunkText(text);

    await query(`delete from public.document_chunks where project_file_id = $1`, [
      fileId,
    ]);

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i]!;
      const embedding = await embedText(content);
      await query(
        `insert into public.document_chunks (
           id, user_id, project_id, project_file_id, source_type, source_id,
           chunk_index, content, token_count, embedding
         ) values ($1, $2, $3, $4, 'project_file', $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          file.user_id,
          file.project_id,
          fileId,
          i,
          content,
          Math.ceil(content.length / 4),
          embedding,
        ],
      );
    }

    await queryOne(
      `update public.project_files
       set status = 'ready', error_message = null, updated_at = now()
       where id = $1 returning id`,
      [fileId],
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingestion failed.";
    await queryOne(
      `update public.project_files
       set status = 'failed', error_message = $2, updated_at = now()
       where id = $1 returning id`,
      [fileId, message],
    );
    throw error;
  }
}

export async function enqueueFileIngestion(fileId: string) {
  try {
    const { ingestionQueue } = await import("@/projects/queue/ingestion");
    await ingestionQueue.add("ingest", { fileId }, { removeOnComplete: true });
  } catch {
    await processProjectFile(fileId);
  }
}

export function buildRagContextBlock(
  chunks: Array<{ content: string }>,
): string {
  if (!chunks.length) return "";
  const body = chunks.map((c) => c.content).join("\n---\n");
  return `<project_knowledge>\n${body}\n</project_knowledge>`;
}

export function assembleSystemPrompt(
  projectInstructions: string | null | undefined,
  ragContext: string,
): string | undefined {
  const parts: string[] = [];
  if (projectInstructions?.trim()) parts.push(projectInstructions.trim());
  if (ragContext.trim()) {
    if (parts.length) parts.push("");
    parts.push(ragContext.trim());
    parts.push("");
    parts.push(
      "Always ground your answers in the provided project knowledge. If information is not found in the provided context, say so clearly.",
    );
  }
  return parts.length ? parts.join("\n") : undefined;
}
