import { chatDocumentMetadata } from "@/server/chat/chat-document-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  return chatDocumentMetadata(chatId);
}

export default function ChatIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
