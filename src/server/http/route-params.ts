import type { NextRequest } from "next/server";
import { withApiHandler, type ApiHandler } from "@/server/http/api-handler";

export function withApiRoute(
  handler: ApiHandler,
  options?: { requireAuth?: boolean; requireChatAuth?: boolean },
) {
  return (
    request: NextRequest,
    _context?: { params: Promise<Record<string, string>> },
  ) => withApiHandler(handler, options)(request);
}

export function withApiRouteParams<T extends Record<string, string>>(
  handler: (
    ctx: Parameters<ApiHandler>[0] & { params: T },
  ) => Promise<Response>,
  options?: { requireAuth?: boolean; requireChatAuth?: boolean },
) {
  return async (request: NextRequest, context: { params: Promise<T> }) => {
    const params = await context.params;
    return withApiHandler(
      (ctx) => handler({ ...ctx, params }),
      options,
    )(request);
  };
}
