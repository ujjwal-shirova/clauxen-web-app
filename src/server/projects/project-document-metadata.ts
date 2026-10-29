import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { formatProjectTabTitle } from "@/lib/document-title";
import { getClaimsFromCookies } from "@/server/auth/jwt";
import * as projectsRepo from "@/server/repositories/projects.repository";

/** Tab title for `/projects/:id`. One name lookup, not the whole project. */
export async function projectDocumentMetadata(
  projectId: string,
): Promise<Metadata> {
  const fallback = { title: formatProjectTabTitle(null) };
  if (!projectId || projectId.length > 200) return fallback;

  try {
    const requestHeaders = await headers();
    // Client navigations are handled by useDocumentTitle; skip the DB round trip.
    if (requestHeaders.get("rsc") === "1") return fallback;

    const claims = await getClaimsFromCookies(await cookies());
    if (!claims) return fallback;

    const name = await Promise.race([
      projectsRepo.getProjectName(projectId, claims.sub),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ]);
    return { title: formatProjectTabTitle(name) };
  } catch {
    return fallback;
  }
}
