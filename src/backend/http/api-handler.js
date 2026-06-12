import { AppError, unauthorized } from "@/backend/db/errors"; // typed application errors — consistent API failures
import { jsonError } from "@/backend/http/api-response";
import { getSessionFromRequest } from "@/backend/auth/session";
import { env } from "@/backend/config/env";
export function withApiHandler(handler, options) {
  return async (request) => {
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
      if (error instanceof AppError) {
        return jsonError(error); // intentional client-facing message + status
      }
      return jsonError(
        new AppError("Internal server error.", 500, "internal_error"),
      );
    }
  };
}
