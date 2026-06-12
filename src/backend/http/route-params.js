import { withApiHandler } from "@/backend/http/api-handler"; // central API wrapper
export function withApiRoute(handler, options) {
  return (request, _context) => withApiHandler(handler, options)(request);
}
export function withApiRouteParams(
  handler, // ctx.params typed
  options,
) {
  return async (request, context) => {
    const params = await context.params;
    return withApiHandler(
      (ctx) => handler({ ...ctx, params }), // ApiContext + route params merge
      options,
    )(request);
  };
}
