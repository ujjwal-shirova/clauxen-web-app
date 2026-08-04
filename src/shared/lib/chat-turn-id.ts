import { randomUUID } from "@/lib/id";

/**
 * Turn identity that survives the database round-trip.
 *
 * A chat turn is exactly one user prompt plus its assistant reply. Both rows
 * persist a `client_id`, so encoding the turn into that value makes pairing
 * authoritative everywhere — optimistic paint, SSE id remap, realtime INSERT /
 * UPDATE, hydrate, and reload — instead of guessing from timestamps.
 *
 *   turnId  = "t-<uuid>"
 *   user    = "t-<uuid>~u"
 *   answer  = "t-<uuid>~a"
 */
const TURN_PREFIX = "t-";
const USER_SUFFIX = "~u";
const ASSISTANT_SUFFIX = "~a";

export function createTurnId(): string {
  return `${TURN_PREFIX}${randomUUID()}`;
}

export function userClientIdForTurn(turnId: string): string {
  return `${turnId}${USER_SUFFIX}`;
}

export function assistantClientIdForTurn(turnId: string): string {
  return `${turnId}${ASSISTANT_SUFFIX}`;
}

/** Recover the turn id from a persisted/optimistic client id. */
export function deriveTurnIdFromClientId(
  clientId: string | null | undefined,
): string | undefined {
  if (typeof clientId !== "string") return undefined;
  const value = clientId.trim();
  if (!value.startsWith(TURN_PREFIX)) return undefined;
  if (value.endsWith(USER_SUFFIX) || value.endsWith(ASSISTANT_SUFFIX)) {
    const turnId = value.slice(0, -USER_SUFFIX.length);
    return turnId.length > TURN_PREFIX.length ? turnId : undefined;
  }
  return undefined;
}
