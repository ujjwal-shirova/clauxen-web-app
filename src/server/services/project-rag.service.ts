import { query } from "@/server/db/pool";
import { embedText, vectorToSql } from "@/projects/lib/embeddings";

export async function retrieveProjectContext(
  projectId: string,
  userId: string,
  queryText: string,
) {
  const queryVector = await embedText(queryText);
  const rows = await query<{ content: string; similarity: number }>(
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

export function buildRagContextBlock(
  chunks: Array<{ content: string }>,
): string {
  if (!chunks.length) return "";
  const body = chunks.map((chunk) => chunk.content).join("\n---\n");
  return `<project_knowledge>\n${body}\n</project_knowledge>`;
}

export { assembleSystemPrompt } from "@/server/inference/system-prompt";
