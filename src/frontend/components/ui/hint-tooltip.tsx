"use client"

import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/frontend/components/ui/tooltip"

interface HintTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentProps<typeof TooltipContent>["side"]
}

export function HintTooltip({ content, children, side = "top" }: HintTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
