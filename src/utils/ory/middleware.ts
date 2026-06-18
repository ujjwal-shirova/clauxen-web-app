import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/backend/config/env";

export async function updateOrySession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!env.oryKratosPublicUrl) {
    return response;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return response;
  }

  try {
    const kratosResponse = await fetch(
      `${env.oryKratosPublicUrl.replace(/\/$/, "")}/sessions/whoami`,
      {
        headers: { cookie: cookieHeader, Accept: "application/json" },
        cache: "no-store",
      },
    );

    const setCookies =
      typeof kratosResponse.headers.getSetCookie === "function"
        ? kratosResponse.headers.getSetCookie()
        : [];

    for (const cookie of setCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
  } catch {
    /* Ory not reachable — continue without session refresh */
  }

  return response;
}
