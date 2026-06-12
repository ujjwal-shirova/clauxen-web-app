import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/frontend/lib/utils";

/** Strip props that bypass React's default XSS escaping when spread onto DOM nodes. */
function omitDangerousDomProps<T extends Record<string, unknown>>({
  dangerouslySetInnerHTML: _dangerouslySetInnerHTML,
  ...safeProps
}: T) {
  return safeProps;
}

const alertVariants = cva(
  // cva — Tailwind variants
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  // forwardRef — UI primitive
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...safeProps}
    />
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  // forwardRef — UI primitive
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...safeProps}
    />
  );
});
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  // forwardRef — UI primitive
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <div
      ref={ref}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...safeProps}
    />
  );
});
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
