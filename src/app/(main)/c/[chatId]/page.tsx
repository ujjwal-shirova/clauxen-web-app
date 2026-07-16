import { ChatView } from "@/frontend/components/chat-view";
import { ChatRouteSeedRegistrar } from "@/frontend/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/backend/chat/load-chat-route-seed";

export default async function ChatRoutePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  // Let the coherent Worker-first seed resolve before falling back to a
  // client hydrate. A 450ms budget caused a visible shimmer on normal cold
  // reads even when the thread arrived immediately afterwards.
  const seed = await Promise.race([
    loadChatRouteSeed(chatId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1_200);
    }),
  ]);

  return (
    <>
      <ChatRouteSeedRegistrar seed={seed} />
      <ChatView />
    </>
  );
}
