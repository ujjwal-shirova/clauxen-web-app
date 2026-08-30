import { Suspense } from "react";
import { AppRouteLoadingShell } from "@/components/app-route-loading-shell";
import { MyClauxenView } from "@/components/my-clauxen-view";

export default function MyClauxenRoutePage() {
  return (
    <Suspense
      fallback={<AppRouteLoadingShell label="Opening My Clauxen" />}
    >
      <MyClauxenView />
    </Suspense>
  );
}
