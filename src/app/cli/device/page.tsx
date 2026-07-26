import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CliDeviceClient } from "@/components/cli/cli-device-client";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Device login - Clauxen Code",
};

export default async function CliDevicePage({
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
    const next = `/cli/device${qs.size ? `?${qs.toString()}` : ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(next)}`);
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--app-shell-bg)] text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <CliDeviceClient />
    </Suspense>
  );
}
