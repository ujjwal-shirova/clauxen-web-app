import * as React from "react"; // React forwardRef

import { cn } from "@/lib/utils"; // className utility

// Textarea — multi-line text input with shadcn styling
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-input bg-white px-3.5 py-3 text-base shadow-[0_1px_2px_rgba(20,22,36,0.025)] ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-[hsl(var(--brand)/0.55)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[hsl(var(--brand)/0.12)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-zinc-900", // base textarea styles
        className,
      )}
      ref={ref} // ref forwarding for focus/autosize libraries
      {...props} // rows, value, onChange, placeholder, etc.
    />
  );
});
Textarea.displayName = "Textarea"; // DevTools label

export { Textarea };
