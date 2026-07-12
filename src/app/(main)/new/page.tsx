import { Suspense } from "react";
import { ChatView } from "@/frontend/components/chat-view";

export default function NewChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}
