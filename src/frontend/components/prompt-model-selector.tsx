"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";
import {
  CHAT_MODEL_OPTIONS,
  getChatModelOption,
  type ChatModelId,
} from "@/lib/chat-models";

type PromptModelSelectorProps = {
  selectedModel: ChatModelId;
  onSelectedModelChange: (model: ChatModelId) => void;
  onUpgradeClick?: () => void;
  thinkingEnabled: boolean;
  onThinkingEnabledChange: (enabled: boolean) => void;
  compact?: boolean;
};

export function PromptModelSelector({
  selectedModel,
  onSelectedModelChange,
  onUpgradeClick,
  thinkingEnabled,
  onThinkingEnabledChange,
  compact = false,
}: PromptModelSelectorProps) {
  const activeModel = getChatModelOption(selectedModel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-md font-medium text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-800 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
            compact
              ? "h-8 max-w-[96px] px-1.5 text-[12px] sm:max-w-[108px]"
              : "h-8 max-w-[108px] px-1.5 text-[12px] sm:h-9 sm:max-w-[120px] sm:text-[13px]",
          )}
        >
          <span className="truncate">{activeModel.shortLabel}</span>
          <ChevronDown className="icon-sm shrink-0 opacity-45" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="z-[70] max-h-[340px] w-[min(calc(100vw-1.5rem),245px)] min-w-[192px] rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-[0_8px_24px_rgba(26,23,18,0.08)]"
      >
        {CHAT_MODEL_OPTIONS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            disabled={!model.available}
            onSelect={() => {
              if (!model.available) return;
              onSelectedModelChange(model.id);
            }}
            className="grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] focus:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{model.label}</span>
                {model.requiresUpgrade ? (
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
                {!model.available ? (
                  <span className="shrink-0 rounded-full border border-zinc-200 px-1.5 py-px text-[11px] text-zinc-500">
                    Soon
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                {model.description}
              </p>
            </div>
            {selectedModel === model.id ? (
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
