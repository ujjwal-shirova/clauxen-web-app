"use client";

import { Check, ChevronDown, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { cn } from "@/frontend/lib/utils";
import {
  CHAT_MODEL_OPTIONS,
  formatChatModelVersionLabel,
  getChatModelOption,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  HOMER_REASONING_EFFORT_OPTIONS,
  getHomerReasoningEffortOption,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

const SIDE_PANEL_CLASS =
  "w-[min(calc(100vw-1.5rem),320px)] min-w-[192px] rounded-xl border border-zinc-900/10 bg-white p-1 text-[14px] leading-5 text-[#0b0b0b] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1),0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]";

const MAIN_PANEL_CLASS =
  "w-[min(calc(100vw-1.5rem),280px)] min-w-[192px] rounded-xl border border-zinc-900/10 bg-white p-1 text-[14px] leading-5 text-[#0b0b0b] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1),0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]";

type PromptModelSelectorProps = {
  selectedModel: ChatModelId;
  onSelectedModelChange: (model: ChatModelId) => void;
  onUpgradeClick?: () => void;
  homerReasoningEffort: HomerReasoningEffort;
  onHomerReasoningEffortChange: (effort: HomerReasoningEffort) => void;
  compact?: boolean;
};

function HomerReasoningSubPanel({
  homerReasoningEffort,
  onHomerReasoningEffortChange,
}: Pick<
  PromptModelSelectorProps,
  "homerReasoningEffort" | "onHomerReasoningEffortChange"
>) {
  return (
    <>
      <div className="px-2.5 py-1 text-[13px] font-[430] leading-4 text-[#898781]">
        Max effort means more thorough responses, but takes longer and uses your
        limits faster.
      </div>

      <div role="group" className="px-1">
        {HOMER_REASONING_EFFORT_OPTIONS.map((option) => {
          const selected = homerReasoningEffort === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onHomerReasoningEffortChange(option.value)}
              className={cn(
                "grid min-h-8 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[14px] font-normal hover:bg-black/5 focus:bg-black/5 focus:outline-none",
                selected && "bg-black/[0.03]",
              )}
            >
              <span className="truncate">{option.label}</span>
              {selected ? (
                <Check className="icon-md shrink-0 text-[#0b0b0b]" />
              ) : (
                <span className="icon-md shrink-0" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function PromptModelSelector({
  selectedModel,
  onSelectedModelChange,
  onUpgradeClick,
  homerReasoningEffort,
  onHomerReasoningEffortChange,
  compact = false,
}: PromptModelSelectorProps) {
  const activeModel = getChatModelOption(selectedModel);
  const activeHomerEffort = getHomerReasoningEffortOption(homerReasoningEffort);
  const isHomer = selectedModel === "homer";

  return (
    <div className="inline-flex shrink-0 items-center gap-0.5">
      {isHomer ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Homer reasoning effort: ${activeHomerEffort.label}`}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-800 outline-none focus:outline-none",
                compact ? "h-8 w-8" : "h-8 w-8 sm:h-9 sm:w-9",
              )}
            >
              <Settings2 className="icon-sm" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            collisionPadding={12}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(SIDE_PANEL_CLASS, "relative overflow-visible")}
          >
            <HomerReasoningSubPanel
              homerReasoningEffort={homerReasoningEffort}
              onHomerReasoningEffortChange={onHomerReasoningEffortChange}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Model: ${activeModel.label}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md font-medium transition-colors hover:bg-black/[0.04] outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
              compact
                ? "h-8 max-w-[148px] px-1.5 text-[12px] sm:max-w-[168px]"
                : "h-8 max-w-[168px] px-1.5 text-[12px] sm:h-9 sm:max-w-[188px] sm:text-[13px]",
            )}
          >
            <span className="truncate text-zinc-800">
              {formatChatModelVersionLabel(activeModel.label)}
            </span>
            <ChevronDown className="icon-sm shrink-0 text-zinc-400 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          sideOffset={8}
          collisionPadding={12}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(MAIN_PANEL_CLASS, "relative overflow-visible")}
        >
          <div className="px-1 pb-1">
            {CHAT_MODEL_OPTIONS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                disabled={!model.available}
                onSelect={() => {
                  if (!model.available) return;
                  onSelectedModelChange(model.id);
                }}
                className="grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] font-[430] focus:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">
                      {formatChatModelVersionLabel(model.label)}
                    </span>
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
                  <Check className="icon-md text-[#2a78d6]" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
