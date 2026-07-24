import { ChatView } from "@/components/chat-view";

/** Serve / as /new without an extra redirect hop (helps FCP on home). */
export default function HomePage() {
  return <ChatView />;
}
