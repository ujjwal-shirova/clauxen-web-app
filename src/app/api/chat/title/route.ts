import { handleChatTitlePost } from "@/backend/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleChatTitlePost(request);
}
