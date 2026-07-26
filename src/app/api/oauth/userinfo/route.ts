import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "Missing or invalid access token." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    sub: session.id,
    email: session.email,
    name: session.displayName,
    preferred_username: session.preferredName,
    picture: session.avatarUrl,
  });
}
