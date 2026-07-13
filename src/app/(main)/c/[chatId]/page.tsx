import { Suspense } from "react";
import { ChatView } from "@/frontend/components/chat-view";
import { ChatRouteSkeleton } from "@/frontend/components/chat-route-skeleton";

export default function ChatRoutePage() {
  return (
    <Suspense fallback={<ChatRouteSkeleton />}>
      <ChatView />
    </Suspense>
  );
}
