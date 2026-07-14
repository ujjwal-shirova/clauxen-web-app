import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign Up - Clauxen",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }
  return null;
}

/** Signup is unified into /login (email exist → sign in, else create + OTP). */
export default async function SignupRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = (await Promise.resolve(searchParams ?? {})) as SearchParams;
  const redirectTo = firstParam(params.redirectTo);
  if (redirectTo) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  redirect("/login");
}
