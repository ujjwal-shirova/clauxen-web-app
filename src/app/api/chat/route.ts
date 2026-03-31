import { handleChatPost } from '@/backend/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleChatPost(request);
}
