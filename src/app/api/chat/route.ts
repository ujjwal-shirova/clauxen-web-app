import { handleChatPost } from '@/backend/chat';

export async function POST(request: Request) {
  return handleChatPost(request);
}
