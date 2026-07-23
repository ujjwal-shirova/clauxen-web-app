import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/frontend/lib/app-routes";

/** Legacy gallery route → inline create form on `/project`. */
export default function LegacyProjectsRedirectPage() {
  redirect(APP_ROUTES.projects);
}
