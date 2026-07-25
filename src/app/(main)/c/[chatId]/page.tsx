import { ChatView } from "@/components/chat-view";
import { ChatRouteSeedRegistrar } from "@/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/server/chat/load-chat-route-seed";

export default async function ChatRoutePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  // Soft-nav from /new already has optimistic turns; cold loads get a longer
  // Worker-first seed so India↔us-west-1 hits can still win the race.
  const seed = await Promise.race([
    loadChatRouteSeed(chatId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 400);
    }),
  ]);

  return (
    <>
      <ChatRouteSeedRegistrar seed={seed} />
      <ChatView />
    </>
  );
}
