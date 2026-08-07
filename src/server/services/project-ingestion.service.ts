import { query, queryOne } from "@/server/db/pool";
import { chunkText } from "@/projects/lib/chunking";
import { embedText, embedTexts, vectorToSql } from "@/projects/lib/embeddings";
import { getObject } from "@/server/storage/object-store";
import { extractTextFromBuffer } from "@/server/services/text-extract.service";

export async function retrieveProjectContext(
  projectId: string,
  userId: string,
  queryText: string,
) {
  const queryVector = await embedText(queryText);
  const rows = await query<{
    content: string;
    similarity: number;
  }>(
    `select dc.content, 1 - (e.embedding <=> $3::extensions.vector) as similarity
     from public.embeddings e
     join public.document_chunks dc on dc.id = e.chunk_id
     where dc.user_id = $1::uuid
       and dc.source_type = 'project_file'
       and dc.metadata->>'project_id' = $2
       and e.embedding is not null
     order by e.embedding <=> $3::extensions.vector
     limit 8`,
    [userId, projectId, vectorToSql(queryVector)],
  );

  return rows.filter((row) => Number(row.similarity) > 0.2);
}

export async function processProjectFile(fileId: string) {
  const file = await queryOne<{
    id: string;
    project_id: string;
    user_id: string;
    filename: string;
    mime_type: string | null;
    storage_bucket: string;
    storage_path: string;
  }>(
    `select id, project_id, user_id, original_name as filename, mime_type,
            storage_bucket, storage_path
     from public.user_files
     where id = $1 and project_id is not null and status != 'deleted'`,
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
    // Bound per-file retrieval cost and batch both provider and Postgres work.
    const chunks = chunkText(text).slice(0, 200);

    await query(
      `delete from public.document_chunks
       where source_type = 'project_file' and source_id = $1`,
      [fileId],
    );

    for (let offset = 0; offset < chunks.length; offset += 16) {
      const batch = chunks.slice(offset, offset + 16);
      const vectors = await embedTexts(batch);
      const records = batch.map((content, index) => ({
        chunk_index: offset + index,
        content,
        token_count: Math.ceil(content.length / 4),
        embedding: vectorToSql(vectors[index]!),
      }));
      await query(
        `with input as (
           select * from jsonb_to_recordset($4::jsonb) as x(
             chunk_index integer, content text, token_count integer, embedding text
           )
         ), chunks as (
           insert into public.document_chunks (
             user_id, source_type, source_id, chunk_index, content, token_count,
             metadata
           )
           select $1, 'project_file', $2, i.chunk_index, i.content,
                  i.token_count,
                  jsonb_build_object('project_id', $3, 'filename', $5)
           from input i
           returning id, chunk_index
         )
         insert into public.embeddings (
           chunk_id, user_id, provider, model_id, embedding, dimensions
         )
         select c.id, $1, 'novita', 'baai/bge-m3',
                i.embedding::extensions.vector, 1536
         from chunks c
         join input i using (chunk_index)`,
        [
          file.user_id,
          fileId,
          file.project_id,
          JSON.stringify(records),
          file.filename,
        ],
      );
    }

    await queryOne(
      `update public.user_files
       set status = 'ready',
           metadata = coalesce(metadata, '{}'::jsonb) - 'ingestion_error',
           updated_at = now()
       where id = $1 returning id`,
      [fileId],
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingestion failed.";
    await queryOne(
      `update public.user_files
       set status = 'failed', metadata = coalesce(metadata, '{}'::jsonb) ||
         jsonb_build_object('ingestion_error', $2::text), updated_at = now()
       where id = $1 returning id`,
      [fileId, message],
    );
    throw error;
  }
}

export async function enqueueFileIngestion(fileId: string) {
  // Vercel has no long-running BullMQ worker process. `after()` keeps the
  // request function alive while this durable database-backed state machine
  // extracts and embeds the file.
  if (process.env.VERCEL === "1" || !process.env.REDIS_URL?.trim()) {
    await processProjectFile(fileId);
    return;
  }
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

export { assembleSystemPrompt } from "@/server/inference/system-prompt";
