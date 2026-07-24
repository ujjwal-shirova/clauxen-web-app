import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { clearSessionCookieHeader } from "@/server/auth/session";
import {
  IDENTITY_HINT_COOKIE,
  identityHintCookieOptions,
} from "@/utils/identity-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(async () => {
  const response = jsonData({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookieHeader());
  response.cookies.set(IDENTITY_HINT_COOKIE, "", {
    ...identityHintCookieOptions(0),
    maxAge: 0,
  });
  return response;
});
