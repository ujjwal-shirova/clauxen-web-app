"use client";

import { DurableResearchPlanCard } from "./durable-research-plan-card";
import type { DeepResearchPlan } from "@/lib/deep-research";

import { ResearchPlanLoading } from "./research-plan-loading";
export { ResearchPlanLoading } from "./research-plan-loading";

export function DeepResearchPlanCard(props: {
  plan: DeepResearchPlan;
  planId: string;
  isStreaming: boolean;
  preparing?: boolean;
  durable?: boolean;
}) {
  if (props.preparing || (!props.durable && props.isStreaming))
    return <ResearchPlanLoading />;
  return (
    <DurableResearchPlanCard
      plan={props.plan}
      planId={props.planId}
      preparing={false}
      legacy={!props.durable}
    />
  );
}
