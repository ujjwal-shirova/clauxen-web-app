import { Suspense } from "react";
import { LibraryView } from "@/components/library-view";

export default function LibraryRoutePage() {
  return (
    <Suspense fallback={null}>
      <LibraryView />
    </Suspense>
  );
}
