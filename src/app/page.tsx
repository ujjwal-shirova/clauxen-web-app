import { Suspense } from "react";
import Home from "@/frontend/app/page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
