import { query } from "@/backend/db/pool";
import { embedText } from "@/projects/lib/embeddings";

const TOP_K = 8;

export async function retrieveProjectContext(projectId: string, queryText: string) {
  const vector = await embedText(queryText);
  const vectorLiteral = `{${vector.join(",")}}`;

  const rows = await query<{ content: string; similarity: number }>(
    `SELECT content,
            1 - (
              SELECT sqrt(sum((a - b) * (a - b)))
              FROM unnest(embedding) WITH ORDINALITY AS t1(a, ord)
              JOIN unnest($1::float8[]) WITH ORDINALITY AS t2(b, ord2) ON t1.ord = t2.ord2
            ) / greatest(sqrt(sum(a * a)), 1e-9) AS similarity
     FROM public.document_chunks
     WHERE project_id = $2::uuid AND embedding IS NOT NULL
     ORDER BY similarity DESC
     LIMIT ${TOP_K}`,
    [vectorLiteral, projectId],
  );

  return rows.filter((r) => r.similarity > 0.2);
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

  if (projectInstructions?.trim()) {
    parts.push(projectInstructions.trim());
  }

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
