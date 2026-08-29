"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CHAT_MODEL_OPTIONS,
  getChatModelOption,
  type ChatModelId,
} from "@/lib/chat-models";

type PromptModelSelectorProps = {
  selectedModel: ChatModelId;
  onSelectedModelChange: (model: ChatModelId) => void;
  isFreePlan?: boolean;
  onUpgradeClick?: () => void;
};

export function PromptModelSelector({
  selectedModel,
  onSelectedModelChange,
  isFreePlan = false,
  onUpgradeClick,
}: PromptModelSelectorProps) {
  const activeModel = getChatModelOption(selectedModel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${activeModel.label}`}
          className="no-hover-overlay inline-flex h-8 max-w-[148px] shrink-0 items-center gap-1.5 rounded-lg bg-[#f6f6f4] px-2.5 text-[13px] font-normal leading-5 text-[#0b0b0b] outline-none transition-colors duration-150 hover:bg-[#efefec] focus-visible:ring-2 focus-visible:ring-[#256abf]/35 sm:max-w-[180px]"
        >
          <span className="truncate">{activeModel.label}</span>
          <ChevronDown
            className="size-3.5 shrink-0 text-[#898781]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="z-[120] w-[min(calc(100vw-1.5rem),416px)] min-w-[220px] rounded-xl border border-[#0b0b0b]/10 bg-white p-1 font-sans text-[14px] leading-5 text-[#0b0b0b] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.04),0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]"
      >
        {CHAT_MODEL_OPTIONS.map((model) => {
          const selected = selectedModel === model.id;
          const requiresUpgrade = isFreePlan && model.requiresUpgrade;
          return (
            <DropdownMenuItem
              key={model.id}
              role="menuitemradio"
              aria-checked={selected}
              aria-disabled={requiresUpgrade || undefined}
              onSelect={() => {
                if (requiresUpgrade) {
                  onUpgradeClick?.();
                  return;
                }
                onSelectedModelChange(model.id);
              }}
              className="grid min-h-[52px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 pb-[7px] pt-1.5 text-left outline-none focus:bg-black/5 data-[highlighted]:bg-black/5"
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-normal leading-5 text-[#0b0b0b]">
                  <span className="truncate">{model.label}</span>
                  {model.requiresUpgrade ? (
                    <span className="shrink-0 rounded-md bg-[#d8e9ff] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#1e5d9f]">
                      Pro
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[13px] font-normal leading-[17px] text-[#898781]">
                  {model.description}
                </span>
              </span>
              {requiresUpgrade ? (
                <span className="shrink-0 rounded-md bg-[#d8e9ff] px-2 py-0.5 text-[12px] font-medium leading-5 text-[#1e5d9f]">
                  Upgrade
                </span>
              ) : selected ? (
                <Check
                  className="size-5 shrink-0 text-[#2a78d6]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : (
                <span className="w-5 shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
