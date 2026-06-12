import { query } from "@/backend/db/pool";
import { isDatabaseConfigured } from "@/backend/config/env";

export async function logInferenceTelemetry(input: {
  userId?: string | null;
  mode: "chat" | "title";
  status: "success" | "error";
  model: string;
  messageCount: number;
  responseCharacterCount?: number;
  latencyMs?: number;
  errorMessage?: string;
}) {
  if (!isDatabaseConfigured()) return;

  try {
    await query(
      `insert into public.inference_gateway_requests (
         gateway, provider, mode, status, model,
         prompt_message_count, response_character_count, latency_ms, error_message,
         metadata, request_finished_at
       ) values (
         'shirova', 'novita', $1, $2, $3,
         $4, $5, $6, $7,
         $8::jsonb, now()
       )`,
      [
        input.mode,
        input.status,
        input.model,
        input.messageCount,
        input.responseCharacterCount ?? 0,
        input.latencyMs ?? null,
        input.errorMessage ?? null,
        JSON.stringify({ user_id: input.userId ?? null }),
      ],
    );
  } catch {
    // Telemetry must not break chat.
  }
}
