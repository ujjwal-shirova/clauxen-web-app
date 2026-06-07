// Menubar — Radix UI desktop-style menu bar primitives (shadcn pattern)
"use client"

import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"  // submenu expand arrow icon (Hindi: submenu expand arrow icon)

import { cn } from "@/frontend/lib/utils"

/** Strip props that bypass React's default XSS escaping when spread onto DOM nodes. */
function omitDangerousDomProps<T extends Record<string, unknown>>({
  dangerouslySetInnerHTML: _dangerousSetInnerHTML,
  ...safeProps
}: T) {
  return safeProps
}

function MenubarMenu({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {  // Radix Menubar.Menu — single top-level menu (Hindi: Radix Menubar.Menu)
  return <MenubarPrimitive.Menu {...props} />  // Radix Menubar.Menu — single top-level menu (Hindi: Radix Menubar.Menu)
}  // scope/component block end

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group {...props} />
}  // scope/component block end

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal {...props} />
}  // scope/component block end

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {  // Radix RadioGroup — exclusive menu options (Hindi: Radix RadioGroup)
  return <MenubarPrimitive.RadioGroup {...props} />  // Radix RadioGroup — exclusive menu options (Hindi: Radix RadioGroup)
}  // scope/component block end

function MenubarSub({
  ...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {  // Radix Sub — nested submenu root (Hindi: Radix Sub)
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />  // Radix Sub — nested submenu root (Hindi: Radix Sub)
}  // scope/component block end

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,  // Radix Menubar root — horizontal menu bar (Hindi: Radix Menubar root)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>  // Radix Menubar root — horizontal menu bar (Hindi: Radix Menubar root)
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root  // Radix Menubar root — horizontal menu bar (Hindi: Radix Menubar root)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "flex h-10 items-center space-x-1 rounded-md border bg-background p-1",
      className
    )}
    {...props}
  />
))
Menubar.displayName = MenubarPrimitive.Root.displayName  // React DevTools displayName assign

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",  // Radix open state — animation classes trigger (Hindi: Radix open state)
      className
    )}
    {...props}
  />
))
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName  // React DevTools displayName assign

const MenubarSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubTrigger>,  // Radix Sub — nested submenu root (Hindi: Radix Sub)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {  // Radix Sub — nested submenu root (Hindi: Radix Sub)
    inset?: boolean
  }  // scope/component block end
>(({ className, inset, children, ...props }, ref) => (
  <MenubarPrimitive.SubTrigger  // Radix Sub — nested submenu root (Hindi: Radix Sub)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",  // Radix open state — animation classes trigger (Hindi: Radix open state)
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />  // submenu expand arrow icon (Hindi: submenu expand arrow icon)
  </MenubarPrimitive.SubTrigger>  // Radix Sub — nested submenu root (Hindi: Radix Sub)
))
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName  // React DevTools displayName assign

const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,  // Radix Sub — nested submenu root (Hindi: Radix Sub)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>  // Radix Sub — nested submenu root (Hindi: Radix Sub)
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.SubContent  // Radix Sub — nested submenu root (Hindi: Radix Sub)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",  // Radix open state — animation classes trigger (Hindi: Radix open state)
      className
    )}
    {...props}
  />
))
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName  // React DevTools displayName assign

const MenubarContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Content>,  // menu dropdown panel — positioned popover (Hindi: menu dropdown panel)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>  // menu dropdown panel — positioned popover (Hindi: menu dropdown panel)
>(
  (
    { className, align = "start", alignOffset = -4, sideOffset = 8, ...props },
    ref
  ) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content  // menu dropdown panel — positioned popover (Hindi: menu dropdown panel)
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(  // Tailwind classes merge — cn() utility
          "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",  // Radix open state — animation classes trigger (Hindi: Radix open state)
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
)
MenubarContent.displayName = MenubarPrimitive.Content.displayName  // React DevTools displayName assign

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,  // clickable menu item row (Hindi: clickable menu item row)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {  // clickable menu item row (Hindi: clickable menu item row)
    inset?: boolean
  }  // scope/component block end
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item  // clickable menu item row (Hindi: clickable menu item row)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarItem.displayName = MenubarPrimitive.Item.displayName  // React DevTools displayName assign

const MenubarCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,  // toggle checkbox menu item (Hindi: toggle checkbox menu item)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>  // toggle checkbox menu item (Hindi: toggle checkbox menu item)
>(({ className, children, checked, ...props }, ref) => (
  <MenubarPrimitive.CheckboxItem  // toggle checkbox menu item (Hindi: toggle checkbox menu item)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>  // clickable menu item row (Hindi: clickable menu item row)
        <Check className="h-4 w-4" />  // checkbox checked tick icon (Hindi: checkbox checked tick icon)
      </MenubarPrimitive.ItemIndicator>  // clickable menu item row (Hindi: clickable menu item row)
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>  // toggle checkbox menu item (Hindi: toggle checkbox menu item)
))
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName  // React DevTools displayName assign

const MenubarRadioItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.RadioItem>,  // radio selection menu item (Hindi: radio selection menu item)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>  // radio selection menu item (Hindi: radio selection menu item)
>(({ className, children, ...props }, ref) => (
  <MenubarPrimitive.RadioItem  // radio selection menu item (Hindi: radio selection menu item)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>  // clickable menu item row (Hindi: clickable menu item row)
        <Circle className="h-2 w-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>  // clickable menu item row (Hindi: clickable menu item row)
    </span>
    {children}
  </MenubarPrimitive.RadioItem>  // radio selection menu item (Hindi: radio selection menu item)
))
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName  // React DevTools displayName assign

const MenubarLabel = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Label>,  // non-interactive section label (Hindi: non-interactive section label)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {  // non-interactive section label (Hindi: non-interactive section label)
    inset?: boolean
  }  // scope/component block end
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Label  // non-interactive section label (Hindi: non-interactive section label)
    ref={ref}
    className={cn(  // Tailwind classes merge — cn() utility
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarLabel.displayName = MenubarPrimitive.Label.displayName  // React DevTools displayName assign

const MenubarSeparator = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Separator>,  // menu divider line (Hindi: menu divider line)
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>  // menu divider line (Hindi: menu divider line)
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Separator  // menu divider line (Hindi: menu divider line)
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}  // Tailwind classes merge — cn() utility
    {...props}
  />
))
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName  // React DevTools displayName assign

const MenubarShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {  // scope/component block end
  return (  // JSX/value return
    <span
      className={cn(  // Tailwind classes merge — cn() utility
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}  // scope/component block end
MenubarShortcut.displayname = "MenubarShortcut"

export {  // named exports block (Hindi: named exports block)
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}  // scope/component block end
