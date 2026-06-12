"use client";

import type { CSSProperties } from "react";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { cn } from "@/frontend/lib/utils";

const SKELETON_BAR = "bg-[rgba(11,11,11,0.1)]";

type ProjectCardSkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function ProjectCardSkeleton({
  className,
  style,
}: ProjectCardSkeletonProps) {
  return (
    <div
      className={cn(
        "flex h-[140px] flex-col gap-4 rounded-xl border border-[rgba(11,11,11,0.1)] bg-zinc-50 p-4 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)]",
        className,
      )}
      style={style}
      aria-hidden
    >
      <Skeleton
        className={cn("h-4 w-[60%] rounded-lg", SKELETON_BAR)}
        animation="shimmer"
      />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton
          className={cn("h-3 w-full rounded-lg", SKELETON_BAR)}
          animation="shimmer"
        />
        <Skeleton
          className={cn("h-3 w-[85%] rounded-lg", SKELETON_BAR)}
          animation="shimmer"
        />
      </div>
      <Skeleton
        className={cn("mt-auto h-2.5 w-[100px] rounded-lg", SKELETON_BAR)}
        animation="shimmer"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ProjectCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="min-w-0">
          <ProjectCardSkeleton
            style={{ ["--skeleton-delay" as string]: `${i * 60}ms` }}
          />
        </li>
      ))}
    </ul>
  );
}
