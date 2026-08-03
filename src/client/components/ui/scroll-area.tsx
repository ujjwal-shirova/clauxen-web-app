"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
>;

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, ...props }, ref) => {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn(
        "relative min-h-0 overflow-hidden",
        "h-full",
        className,
      )}
      {...props}
    >
      {/* `scrollbar-none` hides the native bar so the overlay scrollbar below
          is the only one — two bars rendered at different offsets read as a
          stray line floating inside the transcript. */}
      <ScrollAreaPrimitive.Viewport
        tabIndex={0}
        data-scroll-region=""
        className="app-scrollbar chat-scroll-viewport scrollbar-none relative z-0 size-full min-h-0 rounded-[inherit] scroll-auto outline-none [overflow-anchor:none] [&>div]:!block"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        orientation="vertical"
        className="absolute right-0 top-0 z-30 flex h-full w-2.5 touch-none select-none border-l border-transparent p-0.5 transition-colors"
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
      "absolute z-30 flex touch-none select-none p-0.5 transition-colors",
      orientation === "vertical" &&
        "right-0 top-0 h-full w-2.5 border-l border-transparent",
      orientation === "horizontal" &&
        "bottom-0 left-0 h-2.5 w-full border-t border-transparent",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-zinc-300/80 hover:bg-zinc-400/90" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
