import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const { dangerouslySetInnerHTML: _dangerouslySetInnerHTML, ...safeProps } =
      props;

    return (
      <input
        type={type}
        {...safeProps}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-[var(--radius-sm)] border border-input bg-background px-3 py-2 text-base shadow-[0_1px_2px_rgba(24,24,27,0.02)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
