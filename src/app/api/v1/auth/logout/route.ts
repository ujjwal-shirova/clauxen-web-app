import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { clearSessionCookieHeader } from "@/backend/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(async () => {
  const response = jsonData({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookieHeader());
  return response;
});
