import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OauthError, startDeviceAuthorization } from "@/server/oauth/service";
import { CLAUXEN_CODE_CLIENT_ID } from "@/server/oauth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const clientId = body.client_id || CLAUXEN_CODE_CLIENT_ID;
    const result = await startDeviceAuthorization({
      clientId,
      scope: body.scope ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OauthError) {
      return NextResponse.json(
        { error: error.oauthError, error_description: error.message },
        { status: error.status },
      );
    }
    console.error("[oauth/device/code]", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error." },
      { status: 500 },
    );
  }
}
