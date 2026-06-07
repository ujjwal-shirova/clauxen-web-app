"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/frontend/lib/utils";

/**
 * Skeleton placeholder with optional left-to-right shimmer (GPU-friendly
 * transform on ::after per https://asoasis.tech/articles/2026-05-19-1455-react-skeleton-screen-shimmer-effect/).
 */
const skeletonVariants = cva(
  "skeleton relative block shrink-0 overflow-hidden bg-[var(--skeleton-base)]",
  {
    variants: {
      variant: {
        block: "rounded-lg",
        text: "h-4 rounded-md",
        circle: "rounded-full",
        pill: "rounded-full",
      },
      animation: {
        shimmer: "skeleton--shimmer",
        pulse: "animate-pulse bg-[var(--skeleton-base)]",
        none: "",
      },
    },
    defaultVariants: {
      variant: "block",
      animation: "shimmer",
    },
  },
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, animation, style, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn(skeletonVariants({ variant, animation }), className)}
      style={style}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";

export { Skeleton, skeletonVariants };
