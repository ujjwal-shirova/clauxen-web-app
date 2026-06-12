"use client"; // client — Radix Separator orientation attributes

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator"; // accessible divider primitive

import { cn } from "@/frontend/lib/utils";

// Separator — visual divider line (horizontal or vertical)
const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props }, // decorative=true → purely visual, not focusable landmark
    ref,
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative} // ARIA: decorative separators ignored by screen readers
      orientation={orientation} // "horizontal" | "vertical"
      className={cn(
        "shrink-0 bg-border", // base border color line
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", // dimension by orientation
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
