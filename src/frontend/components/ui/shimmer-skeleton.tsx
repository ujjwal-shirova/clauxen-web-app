"use client";

import * as React from "react";

import { cn } from "@/frontend/lib/utils";

export type ShimmerSkeletonProps = {
  /** When true, shows the skeleton fallback instead of children. */
  loading: boolean;
  /** Skeleton layout shown while loading. */
  fallback: React.ReactNode;
  /** Content shown when loading is complete. */
  children: React.ReactNode;
  className?: string;
  /** Screen-reader label while loading. */
  label?: string;
};

/**
 * Accessible loading shell: decorative skeleton is hidden from AT;
 * status is announced via role="status" + visually hidden label.
 */
export function ShimmerSkeleton({
  loading,
  fallback,
  children,
  className,
  label = "Loading",
}: ShimmerSkeletonProps) {
  if (loading) {
    return (
      <div
        className={cn(className)}
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        <span className="sr-only">{label}</span>
        {fallback}
      </div>
    );
  }

  return <>{children}</>;
}
