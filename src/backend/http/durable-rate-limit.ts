import { AppError } from "@/backend/db/errors";
import { queryOne } from "@/backend/db/pool";
import { assertRateLimit } from "@/backend/http/rate-limit";

/**
 * Durable fixed-window counter in `public.rate_limits` (service role).
 * Falls back to process-local Map if the DB is unavailable.
 */
export async function assertDurableRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}): Promise<void> {
  const windowSec = Math.max(1, Math.floor(options.windowMs / 1000));
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / 1000 / windowSec) * windowSec;
  const id = `${options.key}:${windowStart}`;

  try {
    const row = await queryOne<{ count: number }>(
      `insert into public.rate_limits (id, identifier, window_start, count, last_request)
       values ($1, $2, $3, 1, $4)
       on conflict (id) do update
         set count = public.rate_limits.count + 1,
             last_request = excluded.last_request,
             updated_at = now()
       returning count`,
      [id, options.key, windowStart, nowMs],
    );
    const count = Number(row?.count ?? 0);
    if (count > options.limit) {
      throw new AppError(
        options.message ?? "Too many requests. Try again later.",
        429,
        "rate_limited",
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Fail open to process-local so generate never hard-dies on DB blips.
    assertRateLimit(options);
  }
}
