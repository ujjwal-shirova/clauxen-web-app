import { query } from "@/server/db/pool";

/**
 * Enqueue a background chat job onto pgmq (title / warm / embed / streaming_gc).
 * Fail-open — never block generate TTFT.
 */
export async function enqueueChatJob(
  queue: "chat_title" | "history_warm" | "embed_ingest" | "streaming_gc",
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    await query(`select public.enqueue_chat_job($1, $2::jsonb)`, [
      queue,
      JSON.stringify(payload),
    ]);
    return true;
  } catch (error) {
    console.warn("[pgmq] enqueue failed:", queue, error);
    return false;
  }
}
