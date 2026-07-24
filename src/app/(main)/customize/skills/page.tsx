import { Suspense } from "react";
import { CustomizeRouteContent } from "@/components/customize-route-content";

export default function CustomizeSkillsRoutePage() {
  return (
    <Suspense fallback={null}>
      <CustomizeRouteContent initialTab="skills" />
    </Suspense>
  );
}
