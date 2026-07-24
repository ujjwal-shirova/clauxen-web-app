import { Suspense } from "react";
import { CustomizeRouteContent } from "@/components/customize-route-content";

export default function CustomizeRoutePage() {
  return (
    <Suspense fallback={null}>
      <CustomizeRouteContent />
    </Suspense>
  );
}
