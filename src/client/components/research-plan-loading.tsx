"use client";

export function ResearchPlanLoading() {
  return (
    <p
      role="status"
      aria-busy="true"
      className="research-plan-loading my-3 text-[14px] leading-6"
    >
      <span className="shimmer-text" data-shimmer-active>
        Preparing your research plan…
      </span>
    </p>
  );
}
