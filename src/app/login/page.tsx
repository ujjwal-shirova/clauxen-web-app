import { redirect } from "next/navigation";

/**
 * The standalone login page is gone — guests use the in-app sign-in dialog
 * over the live app preview. This route survives only as a redirect so old
 * bookmarks and provider error links keep working: `/login?redirectTo=%2F`
 * lands on `/new` with the sign-in dialog open.
 */
export default async function LoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const target = new URL("/new", "http://n");
  target.searchParams.set("auth", "1");
  target.searchParams.set("redirectTo", params.redirectTo || "/");
  if (params.error) target.searchParams.set("error", params.error);
  redirect(`${target.pathname}${target.search}`);
}
