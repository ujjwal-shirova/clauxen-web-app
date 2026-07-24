// Toast — Radix Toast notification primitives + swipe dismiss variants
"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast"; // Radix Toast primitive (Hindi: Radix Toast primitive)
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Strip props that bypass React's default XSS escaping when spread onto DOM nodes. */
function omitDangerousDomProps<T extends Record<string, unknown>>({
  dangerouslySetInnerHTML: _dangerousSetInnerHTML,
  ...safeProps
}: T) {
  return safeProps;
}

const ToastProvider = ToastPrimitives.Provider; // Radix Toast primitive (Hindi: Radix Toast primitive)

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> // Radix Toast primitive (Hindi: Radix Toast primitive)
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <ToastPrimitives.Viewport // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      className={cn(
        // Tailwind classes merge — cn() utility
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className,
      )}
      {...safeProps}
    />
  );
});
ToastViewport.displayName = ToastPrimitives.Viewport.displayName; // React DevTools displayName assign

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full", // Radix open state — animation classes trigger (Hindi: Radix open state)
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      }, // scope/component block end
    }, // scope/component block end
    defaultVariants: {
      variant: "default",
    }, // scope/component block end
  }, // scope/component block end
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & // Radix Toast primitive (Hindi: Radix Toast primitive)
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    // JSX/value return
    <ToastPrimitives.Root // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      className={cn(toastVariants({ variant }), className)} // Tailwind classes merge — cn() utility
      {...safeProps}
    />
  );
}); // scope/component block end
Toast.displayName = ToastPrimitives.Root.displayName; // React DevTools displayName assign

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> // Radix Toast primitive (Hindi: Radix Toast primitive)
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <ToastPrimitives.Action // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      type="button"
      className={cn(
        // Tailwind classes merge — cn() utility
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
        className,
      )}
      {...safeProps}
    />
  );
});
ToastAction.displayName = ToastPrimitives.Action.displayName; // React DevTools displayName assign

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> // Radix Toast primitive (Hindi: Radix Toast primitive)
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <ToastPrimitives.Close // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      type="button"
      className={cn(
        // Tailwind classes merge — cn() utility
        "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
        className,
      )}
      toast-close=""
      {...safeProps}
    >
      <X className="h-4 w-4" />
    </ToastPrimitives.Close> // Radix Toast primitive (Hindi: Radix Toast primitive)
  );
});
ToastClose.displayName = ToastPrimitives.Close.displayName; // React DevTools displayName assign

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> // Radix Toast primitive (Hindi: Radix Toast primitive)
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <ToastPrimitives.Title // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      className={cn("text-sm font-semibold", className)} // Tailwind classes merge — cn() utility
      {...safeProps}
    />
  );
});
ToastTitle.displayName = ToastPrimitives.Title.displayName; // React DevTools displayName assign

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>, // Radix Toast primitive (Hindi: Radix Toast primitive)
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description> // Radix Toast primitive (Hindi: Radix Toast primitive)
>(({ className, ...props }, ref) => {
  const safeProps = omitDangerousDomProps(props);
  return (
    <ToastPrimitives.Description // Radix Toast primitive (Hindi: Radix Toast primitive)
      ref={ref}
      className={cn("text-sm opacity-90", className)} // Tailwind classes merge — cn() utility
      {...safeProps}
    />
  );
});
ToastDescription.displayName = ToastPrimitives.Description.displayName; // React DevTools displayName assign

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>; // TypeScript type definition

type ToastActionElement = React.ReactElement<typeof ToastAction>; // TypeScript type definition

export {
  // named exports block (Hindi: named exports block)
  type ToastProps, // TypeScript type definition
  type ToastActionElement, // TypeScript type definition
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}; // scope/component block end
