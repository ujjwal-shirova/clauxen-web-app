import { ChatRouteSurface } from "@/client/components/chat-route-surface";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const prompt = Array.isArray(params.prompt)
    ? params.prompt[0]
    : params.prompt;

  // Same surface component as /c/[chatId] — keeps the chat tree mounted
  // through the /new → /c/:id soft navigation (no reload flash mid-stream).
  return <ChatRouteSurface initialPrompt={prompt} />;
}
