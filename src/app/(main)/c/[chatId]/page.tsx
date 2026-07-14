import { ChatView } from "@/frontend/components/chat-view";
import { ChatRouteSeedRegistrar } from "@/frontend/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/backend/chat/load-chat-route-seed";

export default async function ChatRoutePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  // Budget seed fetch so a cold Worker/DB cannot inflate document TTFB.
  const seed = await Promise.race([
    loadChatRouteSeed(chatId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 450);
    }),
  ]);

  return (
    <>
      <ChatRouteSeedRegistrar seed={seed} />
      <ChatView />
    </>
  );
}
