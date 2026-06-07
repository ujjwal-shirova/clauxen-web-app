"use client" // client — Radix Slider pointer/drag interactions

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider" // accessible range slider

import { cn } from "@/frontend/lib/utils"

// Slider — horizontal value slider with track, range fill, and thumb
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center", // full-width horizontal slider row
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"> {/* gray track */}
      <SliderPrimitive.Range className="absolute h-full bg-primary" /> {/* filled portion from min to thumb */}
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" /> {/* draggable thumb knob */}
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
