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
          className="prompt-model-selector no-hover-overlay no-hover inline-flex h-7 max-w-[140px] shrink-0 items-center gap-1 rounded-[8px] bg-transparent px-2 text-[12.5px] font-normal leading-[18px] text-[var(--ui-fg)] outline-none sm:max-w-[180px]"
        >
          <span className="truncate">{activeModel.label}</span>
          <ChevronDown
            className="size-3.5 shrink-0 text-[var(--ui-fg-muted)]"
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
        className="z-[120] w-[min(calc(100vw-1.5rem),300px)] min-w-[220px] rounded-[var(--popup-radius)] border border-[var(--popup-border)] bg-[var(--popup-bg)] p-1 font-sans text-[13px] leading-[18px] text-[var(--ui-fg)] shadow-[var(--popup-shadow)]"
      >
        {CHAT_MODEL_OPTIONS.map((model) => {
          const selected = selectedModel === model.id;
          const showUpgradeCard = Boolean(model.requiresUpgrade);
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
              className="grid min-h-[40px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--menu-item-radius)] px-2 py-1.5 text-left outline-none focus:bg-[var(--ui-hover-wash)] data-[highlighted]:bg-[var(--ui-hover-wash)]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] text-[var(--ui-fg)]">
                  <span className="truncate">{model.label}</span>
                  {model.requiresUpgrade ? (
                    <span className="shrink-0 rounded-[5px] bg-[var(--brand-soft)] px-1 py-px text-[10.5px] font-medium leading-[14px] text-[var(--link)]">
                      Pro
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[11.5px] font-normal leading-4 text-[var(--ui-fg-muted)]">
                  {model.description}
                </span>
              </span>
              {showUpgradeCard ? (
                <span className="shrink-0 rounded-[6px] bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[var(--link)]">
                  Upgrade
                </span>
              ) : selected ? (
                <Check
                  className="size-4 shrink-0 text-[var(--link)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : (
                <span className="w-4 shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
