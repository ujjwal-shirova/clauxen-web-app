import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/app-routes";

/** Legacy `/projects/[id]` → `/project/[id]` dashboard (new-chat composer). */
export default async function LegacyProjectDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(APP_ROUTES.project(id));
}
