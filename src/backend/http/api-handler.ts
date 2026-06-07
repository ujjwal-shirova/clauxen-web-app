import type { NextRequest } from "next/server";
import { AppError, unauthorized } from "@/backend/db/errors";
import { jsonError } from "@/backend/http/api-response";
import type { SessionUser } from "@/backend/auth/session";
import { getSessionFromRequest } from "@/backend/auth/session";
import { env } from "@/backend/config/env";

export type ApiContext = {
  request: NextRequest;
  session: SessionUser | null;
};

export type ApiHandler = (ctx: ApiContext) => Promise<Response>;

export function withApiHandler(
  handler: ApiHandler,
  options?: { requireAuth?: boolean; requireChatAuth?: boolean },
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    try {
      const session = await getSessionFromRequest(request);

      if (options?.requireAuth && !session) {
        throw unauthorized("Authentication required.");
      }

      if (options?.requireChatAuth && env.authRequiredForChat && !session) {
        throw unauthorized("Authentication required for chat.");
      }

      return await handler({ request, session });
    } catch (error) {
      return jsonError(error instanceof AppError ? error : new AppError(String(error), 500));
    }
  };
}
