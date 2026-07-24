import { unauthorized } from "@/server/db/errors";
import type { SessionUser } from "@/server/auth/session";

export function requireSession(session: SessionUser | null): SessionUser {
  if (!session) {
    throw unauthorized();
  }
  return session;
}
