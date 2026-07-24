import { Suspense } from "react";
import { CustomizeRouteContent } from "@/components/customize-route-content";

export default function CustomizeConnectorsRoutePage() {
  return (
    <Suspense fallback={null}>
      <CustomizeRouteContent initialTab="connectors" />
    </Suspense>
  );
}
