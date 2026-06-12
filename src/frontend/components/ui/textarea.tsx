import * as React from "react"; // React forwardRef

import { cn } from "@/frontend/lib/utils"; // className utility

// Textarea — multi-line text input with shadcn styling
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", // base textarea styles
        className,
      )}
      ref={ref} // ref forwarding for focus/autosize libraries
      {...props} // rows, value, onChange, placeholder, etc.
    />
  );
});
Textarea.displayName = "Textarea"; // DevTools label

export { Textarea };
