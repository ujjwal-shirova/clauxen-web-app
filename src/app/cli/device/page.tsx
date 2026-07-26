import type { Metadata } from "next";
import { Suspense } from "react";
import { CliDeviceClient } from "@/components/cli/cli-device-client";

export const metadata: Metadata = {
  title: "Device login - Clauxen Code",
};

export default function CliDevicePage() {
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
