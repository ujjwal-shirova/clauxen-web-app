import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revokeToken } from "@/server/oauth/service";

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
    const token = body.token;
    if (!token) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "token is required." },
        { status: 400 },
      );
    }
    await revokeToken(token);
    // RFC 7009: always 200
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[oauth/revoke]", error);
    return new NextResponse(null, { status: 200 });
  }
}
