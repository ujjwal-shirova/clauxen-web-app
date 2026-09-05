import { Suspense } from "react";
import { ChatRouteSeedRegistrar } from "@/components/chat-route-seed-registrar";
import { loadChatRouteSeed } from "@/server/chat/load-chat-route-seed";

async function ProjectChatSeed({ chatId }: { chatId: string }) {
  const seed = await loadChatRouteSeed(chatId);
  return <ChatRouteSeedRegistrar seed={seed} />;
}

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { chatId } = await params;
  return (
    <Suspense fallback={null}>
      <ProjectChatSeed chatId={chatId} />
    </Suspense>
  );
}
