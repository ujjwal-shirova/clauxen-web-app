import type { Metadata } from "next";
import { Suspense } from "react";
import { CliAuthorizeClient } from "@/components/cli/cli-authorize-client";

export const metadata: Metadata = {
  title: "Authorize Clauxen Code - Clauxen",
};

export default function CliAuthorizePage() {
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
