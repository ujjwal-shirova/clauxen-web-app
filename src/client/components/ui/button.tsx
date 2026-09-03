import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium tracking-[-0.01em] ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-[var(--icon-size)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-zinc-800 active:bg-zinc-950 no-hover-overlay dark:hover:bg-zinc-200 dark:active:bg-white",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700 no-hover-overlay",
        outline:
          "border border-input bg-background shadow-[0_1px_2px_rgba(24,24,27,0.03)] hover:bg-zinc-50 hover:text-accent-foreground active:bg-zinc-100 dark:hover:bg-white/[0.06]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/[0.08]",
        ghost:
          "hover:bg-zinc-100 hover:text-accent-foreground active:bg-zinc-200 dark:hover:bg-white/[0.07]",
        link: "text-primary underline-offset-4 hover:underline hover:text-zinc-700 no-hover-overlay clickable-label cursor-pointer",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-[var(--radius-sm)] px-3 text-[13px]",
        lg: "h-11 rounded-[var(--radius-md)] px-6",
        icon: "h-8 w-8 p-[7px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
