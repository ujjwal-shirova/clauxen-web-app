import type { NextRequest } from "next/server";
import {
  verifyAuthToken,
  getUserById,
  type AuthUser,
} from "@/server/services/auth-credentials.service";
import { getSessionFromRequest } from "@/server/auth/session";

export type ProjectsAuthUser = AuthUser;

export class ProjectsAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ProjectsAuthError";
  }
}

export class ProjectsApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ProjectsApiError";
  }
}

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireProjectsUser(
  request: NextRequest,
): Promise<ProjectsAuthUser> {
  const token = getBearerToken(request);
  if (token) {
    const user = verifyAuthToken(token);
    if (!user) {
      throw new ProjectsAuthError("Invalid or expired token.", 401);
    }
    const row = await getUserById(user.id);
    if (!row) {
      throw new ProjectsAuthError("User not found.", 401);
    }
    return { id: row.id, email: row.email };
  }

  const session = await getSessionFromRequest(request);
  if (session?.id) {
    return { id: session.id, email: session.email ?? "" };
  }

  throw new ProjectsAuthError("Authentication required.", 401);
}

export {
  registerUser,
  authenticateUser,
  signAuthToken,
  hashPassword,
  verifyPassword,
} from "@/server/services/auth-credentials.service";
