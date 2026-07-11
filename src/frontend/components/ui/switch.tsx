"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/frontend/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "no-hover-overlay peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d0d0d]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg,#ffffff)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[#0d0d0d] data-[state=unchecked]:bg-[#0d0d0d]/25",
      "dark:data-[state=checked]:bg-[#f4f4f5] dark:data-[state=unchecked]:bg-[#f4f4f5]/30",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm ring-0 transition-transform",
        "data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0.5",
        "dark:bg-[#0d0d0d] dark:data-[state=unchecked]:bg-[#ffffff]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
