import { ChatView } from "@/components/chat-view";
import { ChatRouteSeedRegistrar } from "@/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/server/chat/load-chat-route-seed";

export default async function ChatRoutePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  // Keep this short so soft-nav from /new does not stall behind a long seed
  // wait (that previously paired with loading.tsx shimmer). Client optimistic
  // turns already paint; cold loads still get a brief Worker-first seed.
  const seed = await Promise.race([
    loadChatRouteSeed(chatId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 120);
    }),
  ]);

  return (
    <>
      <ChatRouteSeedRegistrar seed={seed} />
      <ChatView />
    </>
  );
}
