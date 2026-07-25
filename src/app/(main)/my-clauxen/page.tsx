import { Suspense } from "react";
import { MyClauxenView } from "@/components/my-clauxen-view";

export default function MyClauxenRoutePage() {
  return (
    <Suspense fallback={null}>
      <MyClauxenView />
    </Suspense>
  );
}
