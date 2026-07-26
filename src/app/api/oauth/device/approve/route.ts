import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/server/auth/session";
import { approveDeviceUserCode } from "@/server/oauth/service";
import { AppError } from "@/server/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: "login_required", message: "Sign in required." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { user_code?: string };
    if (!body.user_code?.trim()) {
      return NextResponse.json(
        { error: "invalid_request", message: "user_code is required." },
        { status: 400 },
      );
    }

    await approveDeviceUserCode({
      userCode: body.user_code,
      userId: session.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("[oauth/device/approve]", error);
    return NextResponse.json(
      { error: "server_error", message: "Internal server error." },
      { status: 500 },
    );
  }
}
