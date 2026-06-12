// Sheet — Radix Dialog-based slide-over panel (mobile drawer pattern)
"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog"; // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/frontend/lib/utils";

const Sheet = SheetPrimitive.Root; // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)

const SheetTrigger = SheetPrimitive.Trigger; // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)

const SheetClose = SheetPrimitive.Close; // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)

const SheetPortal = SheetPrimitive.Portal; // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>, // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
    className={cn(
      // Tailwind classes merge — cn() utility
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", // Radix open state — animation classes trigger (Hindi: Radix open state)
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName; // React DevTools displayName assign

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500", // Radix open state — animation classes trigger (Hindi: Radix open state)
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top", // Radix open state — animation classes trigger (Hindi: Radix open state)
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom", // Radix open state — animation classes trigger (Hindi: Radix open state)
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm", // Radix open state — animation classes trigger (Hindi: Radix open state)
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm", // Radix open state — animation classes trigger (Hindi: Radix open state)
      }, // scope/component block end
    }, // scope/component block end
    defaultVariants: {
      side: "right",
    }, // scope/component block end
  }, // scope/component block end
);

interface SheetContentProps // TypeScript type definition
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>, // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
      ref={ref}
      className={cn(sheetVariants({ side }), className)} // Tailwind classes merge — cn() utility
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        {" "}
        // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet)
        primitive)
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>{" "}
      // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
    </SheetPrimitive.Content>{" "}
    // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName; // React DevTools displayName assign

const SheetHeader = (
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>, // scope/component block end
) => (
  <div
    className={cn(
      // Tailwind classes merge — cn() utility
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader"; // React DevTools displayName assign

const SheetFooter = (
  { className, ...props }: React.HTMLAttributes<HTMLDivElement>, // scope/component block end
) => (
  <div
    className={cn(
      // Tailwind classes merge — cn() utility
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter"; // React DevTools displayName assign

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>, // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title> // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)} // Tailwind classes merge — cn() utility
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName; // React DevTools displayName assign

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>, // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description> // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description // Radix Dialog (Sheet) primitive (Hindi: Radix Dialog (Sheet) primitive)
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)} // Tailwind classes merge — cn() utility
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName; // React DevTools displayName assign

export {
  // named exports block (Hindi: named exports block)
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}; // scope/component block end
