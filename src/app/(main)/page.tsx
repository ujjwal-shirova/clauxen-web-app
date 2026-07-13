import { Suspense } from "react";
import { ChatView } from "@/frontend/components/chat-view";
import { ChatRouteSkeleton } from "@/frontend/components/chat-route-skeleton";

/** Serve / as /new without an extra redirect hop (helps FCP on home). */
export default function HomePage() {
  return (
    <Suspense fallback={<ChatRouteSkeleton />}>
      <ChatView />
    </Suspense>
  );
}
