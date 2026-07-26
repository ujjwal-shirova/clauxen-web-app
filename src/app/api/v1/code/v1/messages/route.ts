import type { NextRequest } from "next/server";
import { handleCodeMessagesPost } from "@/server/code-gateway/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return handleCodeMessagesPost(request);
}
