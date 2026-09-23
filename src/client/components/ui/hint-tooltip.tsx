"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HintTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  sideOffset?: number;
}

export function HintTooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 5,
}: HintTooltipProps) {
  const [open, setOpen] = React.useState(false);

  if (!React.isValidElement(children)) {
    return <>{children}</>;
  }

  const child = children as React.ReactElement<{
    onPointerDown?: (event: React.PointerEvent) => void;
    onClick?: (event: React.MouseEvent) => void;
  }>;

  const trigger = React.cloneElement(child, {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") {
        event.preventDefault();
      }
      child.props.onPointerDown?.(event);
    },
    onClick: (event: React.MouseEvent) => {
      setOpen(false);
      child.props.onClick?.(event);
    },
  });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="z-[70] rounded-[7px] border-0 bg-white px-2 py-1 text-[11.5px] font-medium leading-4 text-zinc-800 shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)]"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
