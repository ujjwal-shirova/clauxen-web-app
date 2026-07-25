import { Suspense } from "react";
import { ScheduledTasksView } from "@/components/scheduled-tasks-view";

export default function ScheduledTasksRoutePage() {
  return (
    <Suspense fallback={null}>
      <ScheduledTasksView />
    </Suspense>
  );
}
