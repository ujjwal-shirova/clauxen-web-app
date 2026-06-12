import { unauthorized } from "@/backend/db/errors";
import type { SessionUser } from "@/backend/auth/session";

export function requireSession(session: SessionUser | null): SessionUser {
  if (!session) {
    throw unauthorized();
  }
  return session;
}
