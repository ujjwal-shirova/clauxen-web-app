import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const { dangerouslySetInnerHTML: _dangerouslySetInnerHTML, ...safeProps } =
      props;

    return (
      <input
        type={type}
        {...safeProps} // native attributes — dangerouslySetInnerHTML stripped (XSS via spread guard)
        ref={ref} // ref last — caller spread cannot override forwarded ref (DOM hijack guard)
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-input bg-white px-3.5 py-2 text-base shadow-[0_1px_2px_rgba(20,22,36,0.025)] ring-offset-background transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-[hsl(var(--brand)/0.55)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[hsl(var(--brand)/0.12)] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60 md:text-sm dark:bg-zinc-900",
          className,
        )}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
