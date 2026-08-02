import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold tracking-[-0.01em] ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--brand)/0.24)] hover:bg-[hsl(var(--brand-strong))] active:bg-[hsl(var(--brand-strong))] no-hover-overlay",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700 no-hover-overlay",
        outline:
          "border border-input bg-white shadow-[0_1px_2px_rgba(20,22,36,0.04)] hover:border-zinc-300 hover:bg-zinc-50/80 hover:text-accent-foreground active:bg-zinc-100 dark:bg-zinc-900",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-zinc-200/70 active:bg-zinc-200",
        ghost:
          "hover:bg-zinc-900/[0.055] hover:text-accent-foreground active:bg-zinc-900/[0.08] dark:hover:bg-white/[0.07]",
        link: "text-primary underline-offset-4 hover:underline hover:text-zinc-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[9px] px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9 rounded-[9px] p-2",
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
