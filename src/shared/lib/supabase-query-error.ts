import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Log PostgREST / Realtime query failures with endpoint shape (table, filter, code).
 * Keeps generic UI errors while making server/browser consoles actionable.
 */
export function logSupabaseQueryError(
  scope: string,
  error: PostgrestError | { message?: string; code?: string; details?: string; hint?: string } | null,
  context?: {
    table?: string;
    filter?: string;
    event?: string;
    chatId?: string;
    userId?: string;
  },
): void {
  if (!error) return;
  console.error(`[supabase:${scope}]`, {
    code: "code" in error ? error.code : null,
    message: error.message ?? null,
    details: "details" in error ? error.details : null,
    hint: "hint" in error ? error.hint : null,
    ...context,
  });
}
