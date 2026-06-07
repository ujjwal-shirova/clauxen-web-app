"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/frontend/lib/utils"

type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  /** Optional right rail (e.g. message navigator) beside the scroll viewport. */
  railEnd?: React.ReactNode
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, railEnd, ...props }, ref) => {
  const hasRailEnd = Boolean(railEnd)

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
          "scrollbar-hide size-full min-h-0 rounded-[inherit] [&>div]:!block",
          hasRailEnd && "min-w-0 flex-1",
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {hasRailEnd ? (
        <div className="relative hidden w-11 shrink-0 md:block">{railEnd}</div>
      ) : null}
      {/* Radix needs a scrollbar node for scroll mechanics; kept invisible. */}
      <ScrollAreaPrimitive.ScrollAreaScrollbar
        orientation="vertical"
        className="flex h-full w-0 shrink-0 touch-none select-none border-0 p-0 opacity-0"
      >
        <ScrollAreaPrimitive.ScrollAreaThumb className="flex-1 bg-transparent" />
      </ScrollAreaPrimitive.ScrollAreaScrollbar>
      <ScrollAreaPrimitive.Corner className="hidden" />
    </ScrollAreaPrimitive.Root>
  )
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none opacity-0",
      orientation === "vertical" && "h-full w-0 border-0 p-0",
      orientation === "horizontal" && "h-0 w-full border-0 p-0",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="flex-1 bg-transparent" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
