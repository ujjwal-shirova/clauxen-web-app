"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";

const MODEL_OPTIONS = [
  {
    name: "Mythos 4.7",
    description: "Most capable for ambitious work",
    requiresUpgrade: true,
  },
  {
    name: "Helios 4.6",
    description: "Responsive everyday work",
  },
  {
    name: "Virgil 4.5",
    description: "Fastest, most efficient",
  },
] as const;

type PromptModelSelectorProps = {
  onUpgradeClick?: () => void;
  thinkingEnabled: boolean;
  onThinkingEnabledChange: (enabled: boolean) => void;
  compact?: boolean;
};

export function PromptModelSelector({
  onUpgradeClick,
  thinkingEnabled,
  onThinkingEnabledChange,
  compact = false,
}: PromptModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState("Helios 4.6");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-md font-medium text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-800 data-[state=open]:bg-black/[0.04] data-[state=open]:text-zinc-800",
            compact
              ? "h-8 max-w-[96px] px-1.5 text-[12px] sm:max-w-[108px]"
              : "h-8 max-w-[108px] px-1.5 text-[12px] sm:h-9 sm:max-w-[120px] sm:text-[13px]",
          )}
        >
          <span className="truncate">{selectedModel.split(" ")[0]}</span>
          <ChevronDown className="icon-sm shrink-0 opacity-45" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] max-h-[340px] w-[min(calc(100vw-1.5rem),245px)] min-w-[192px] rounded-xl border border-zinc-200 bg-white/95 p-1.5 text-zinc-700 shadow-[0_8px_24px_rgba(26,23,18,0.08)] backdrop-blur-xl"
      >
        {MODEL_OPTIONS.map((model) => (
          <DropdownMenuItem
            key={model.name}
            onSelect={() => setSelectedModel(model.name)}
            className="grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] focus:bg-black/5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{model.name}</span>
                {"requiresUpgrade" in model && model.requiresUpgrade ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpgradeClick?.();
                    }}
                    className="shrink-0 rounded-full border border-zinc-200 px-1.5 py-px text-[11px] text-[#184e95] hover:bg-[#184e95]/5"
                  >
                    Upgrade
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                {model.description}
              </p>
            </div>
            {selectedModel === model.name ? (
              <Check className="icon-md text-[#2977d6]" />
            ) : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="mx-2 my-1.5 h-px bg-zinc-900/12" />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onThinkingEnabledChange(!thinkingEnabled);
          }}
          className="grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-[14px] font-[430] focus:bg-black/5"
        >
          <div className="min-w-0">
            <div>Thinking</div>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Thinks for complex tasks
            </p>
          </div>
          <div
            role="switch"
            aria-checked={thinkingEnabled}
            aria-label="Enable thinking"
            className={cn(
              "relative h-4 w-7 shrink-0 rounded-full transition-colors",
              thinkingEnabled ? "bg-[#0d0d0d]" : "bg-[#0d0d0d]/25",
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                thinkingEnabled ? "translate-x-3" : "translate-x-0.5",
              )}
            />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
