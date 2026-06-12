"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/frontend/lib/utils";

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  /** Optional right rail (e.g. message navigator) beside the scroll viewport. */
  railEnd?: React.ReactNode;
};

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, railEnd, ...props }, ref) => {
  const hasRailEnd = Boolean(railEnd);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn(
        "relative min-h-0 overflow-hidden",
        hasRailEnd ? "flex h-full min-h-0 flex-row" : "h-full",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "app-scrollbar relative z-0 size-full min-h-0 rounded-[inherit] [&>div]:!block",
          hasRailEnd && "min-w-0 flex-1",
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {hasRailEnd ? (
        <div className="relative z-30 hidden w-11 shrink-0 md:block">
          {railEnd}
        </div>
      ) : null}
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        orientation="vertical"
        className="flex h-full w-2 touch-none select-none border-l border-transparent p-0.5 transition-colors"
      >
        <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-zinc-300/80 hover:bg-zinc-400/90" />
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
      <ScrollAreaPrimitive.Corner className="hidden" />
    </ScrollAreaPrimitive.Root>
  );
});
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none p-0.5 transition-colors",
      orientation === "vertical" && "h-full w-2 border-l border-transparent",
      orientation === "horizontal" && "h-2 w-full border-t border-transparent",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-zinc-300/80 hover:bg-zinc-400/90" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
