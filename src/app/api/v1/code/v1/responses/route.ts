import type { NextRequest } from "next/server";
import { handleCodeResponsesPost } from "@/server/code-gateway/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return handleCodeResponsesPost(request);
}
