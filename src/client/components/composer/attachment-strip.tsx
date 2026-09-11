"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Single horizontal row of attachment chips. Overflow scrolls sideways only
 * so a large set of files never wraps the composer or edit card taller.
 */
export function ComposerAttachmentStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("composer-attachment-strip scrollbar-hide", className)}
      data-attachment-strip
    >
      {children}
    </div>
  );
}
