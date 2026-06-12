"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/frontend/components/ui/tooltip";

interface HintTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
}

export function HintTooltip({
  content,
  children,
  side = "top",
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
          sideOffset={6}
          className="z-[70] rounded-lg border-0 bg-white px-2.5 py-1.5 text-[12px] font-medium leading-4 text-zinc-800 shadow-[0_8px_12px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.62)]"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
