import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CliAuthorizeClient } from "@/components/cli/cli-authorize-client";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Authorize Clauxen Code - Clauxen",
};

/**
 * CLI authorize entry — requires a Supabase Auth session (same account as the web app).
 * Unauthenticated users are sent to /login with redirectTo preserved.
 */
export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") qs.set(key, value);
    }
    const next = `/cli/authorize${qs.size ? `?${qs.toString()}` : ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(next)}`);
  }

  // Touch headers so Next keeps this dynamic (Supabase cookies).
  await headers();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--app-shell-bg)] text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <CliAuthorizeClient />
    </Suspense>
  );
}
