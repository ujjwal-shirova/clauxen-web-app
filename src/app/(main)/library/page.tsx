import { Suspense } from "react";
import { AppRouteLoadingShell } from "@/components/app-route-loading-shell";
import { LibraryView } from "@/components/library-view";

export default function LibraryRoutePage() {
  return (
    <Suspense
      fallback={
        <AppRouteLoadingShell label="Opening Library" title="Library" />
      }
    >
      <LibraryView />
    </Suspense>
  );
}
