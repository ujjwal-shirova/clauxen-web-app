import { ChatRouteSurface } from "@/client/components/chat-route-surface";

export default function NewChatPage() {
  // Same surface component as /c/[chatId] — keeps the chat tree mounted
  // through the /new → /c/:id soft navigation (no reload flash mid-stream).
  return <ChatRouteSurface />;
}
