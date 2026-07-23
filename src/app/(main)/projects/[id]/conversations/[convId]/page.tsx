import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/frontend/lib/app-routes";

/**
 * Legacy nested project chat → `/c/[chatId]?chat_enter_method=project`.
 */
export default async function LegacyProjectConversationRedirectPage({
  params,
}: {
  params: Promise<{ id: string; convId: string }>;
}) {
  const { convId } = await params;
  redirect(APP_ROUTES.projectChat(convId));
}
