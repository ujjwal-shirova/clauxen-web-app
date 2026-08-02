import { Suspense } from "react";
import { ChatView } from "@/components/chat-view";
import { ChatRouteSeedRegistrar } from "@/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/server/chat/load-chat-route-seed";

/**
 * Stream the shell immediately; hydrate the thread seed in a sibling Suspense
 * boundary so cold opens never withhold the document for the DB race.
 */
async function ChatRouteSeedLoader({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const seed = await loadChatRouteSeed(chatId);
  return <ChatRouteSeedRegistrar seed={seed} />;
}

export default function ChatRoutePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <ChatRouteSeedLoader params={params} />
      </Suspense>
      <ChatView />
    </>
  );
}
