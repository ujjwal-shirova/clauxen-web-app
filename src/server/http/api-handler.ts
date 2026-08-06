import type { NextRequest } from "next/server";
import { AppError, unauthorized } from "@/server/db/errors";
import { jsonError } from "@/server/http/api-response";
import type { SessionUser } from "@/server/auth/session";
import { getSessionFromRequest } from "@/server/auth/session";
import { env } from "@/server/config/env";
import { REQUEST_ID_HEADER, requestId } from "@/server/http/request-meta";

export type ApiContext = {
  request: NextRequest;
  session: SessionUser | null;
  requestId: string;
};

export type ApiHandler = (ctx: ApiContext) => Promise<Response>;

export function withApiHandler(
  handler: ApiHandler,
  options?: { requireAuth?: boolean; requireChatAuth?: boolean },
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const correlationId = requestId(request);
    try {
      const session = await getSessionFromRequest(request);

      if (options?.requireAuth && !session) {
        throw unauthorized("Authentication required.");
      }

      if (options?.requireChatAuth && env.authRequiredForChat && !session) {
        throw unauthorized("Authentication required for chat.");
      }

      const response = await handler({ request, session, requestId: correlationId });
      const headers = new Headers(response.headers);
      headers.set(REQUEST_ID_HEADER, correlationId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const response = jsonError(
        error instanceof AppError ? error : new AppError(String(error), 500),
      );
      response.headers.set(REQUEST_ID_HEADER, correlationId);
      return response;
    }
  };
}
