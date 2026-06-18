import { NextResponse } from "next/server";

const DEPRECATED_MESSAGE =
  "The standalone autonomous-agent API is deprecated. Use POST /api/v1/chats/:chatId/generate with thinkingType enabled.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, _context: RouteContext) {
  return NextResponse.json({ error: DEPRECATED_MESSAGE }, { status: 410 });
}

export async function GET(_request: Request, _context: RouteContext) {
  return NextResponse.json({ error: DEPRECATED_MESSAGE }, { status: 410 });
}
