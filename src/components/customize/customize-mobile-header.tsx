"use client";

import type React from "react";
import { ArrowLeft } from "lucide-react"; // Lucide ArrowLeft — back affordance icon
import { cn } from "@/lib/utils";

interface CustomizeMobileHeaderProps {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  className?: string;
}

export function CustomizeMobileHeader({
  title,
  onBack,
  trailing,
  className,
}: CustomizeMobileHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2.5 md:hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-800 transition-colors hover:bg-zinc-100"
        aria-label="Back to list"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-900">
        {title}
      </h2>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
