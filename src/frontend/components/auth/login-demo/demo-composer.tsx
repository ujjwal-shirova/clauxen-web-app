"use client";

import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";

const SINGLE_LINE_PX = 20;

/** Measure natural content height without min/max constraints (same idea as PromptInput). */
function measureScrollHeight(textarea: HTMLTextAreaElement): number {
  const prev = {
    height: textarea.style.height,
    minHeight: textarea.style.minHeight,
    maxHeight: textarea.style.maxHeight,
    overflow: textarea.style.overflow,
  };
  textarea.style.height = "0px";
  textarea.style.minHeight = "0px";
  textarea.style.maxHeight = "none";
  textarea.style.overflow = "hidden";
  const measured = textarea.scrollHeight;
  textarea.style.height = prev.height;
  textarea.style.minHeight = prev.minHeight;
  textarea.style.maxHeight = prev.maxHeight;
  textarea.style.overflow = prev.overflow;
  return measured;
}

/**
 * Login-demo-only composer — visual twin of PromptInput, fully controlled.
 * Stays collapsed until text truly wraps (welcome + conversation).
 */
export const DemoComposer = forwardRef<
  HTMLDivElement,
  {
    value: string;
    isGenerating?: boolean;
    isConversationStarted?: boolean;
    className?: string;
  }
>(function DemoComposer(
  { value, isGenerating = false, isConversationStarted = false, className },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const multilineRef = useRef(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const hasDraft = value.trim().length > 0;
  const useCompact = !isMultiline;

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    if (!hasDraft) {
      multilineRef.current = false;
      if (isMultiline) setIsMultiline(false);
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
      ta.style.overflow = "hidden";
      return;
    }

    // Keep compact metrics while measuring so width matches the collapsed row.
    if (!multilineRef.current) {
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
    }

    const scrollHeight = measureScrollHeight(ta);
    const hasExplicitNewline = value.includes("\n");
    const fitsSingleLine =
      !hasExplicitNewline && scrollHeight <= SINGLE_LINE_PX + 1;

    if (fitsSingleLine) {
      if (multilineRef.current) {
        multilineRef.current = false;
        setIsMultiline(false);
      }
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
      ta.style.overflow = "hidden";
      return;
    }

    if (!multilineRef.current) {
      multilineRef.current = true;
      setIsMultiline(true);
    }

    const next = Math.min(Math.max(scrollHeight, SINGLE_LINE_PX), 140);
    ta.style.height = `${next}px`;
    ta.style.minHeight = `${SINGLE_LINE_PX}px`;
    ta.style.maxHeight = "140px";
    ta.style.overflow = scrollHeight > 140 ? "auto" : "hidden";
  }, [value, hasDraft, isMultiline]);

  return (
    <div
      ref={ref}
      data-demo-composer
      className={cn(
        "flex w-full flex-col",
        isConversationStarted ? "items-stretch" : "items-center",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "relative flex w-full flex-col",
          !isConversationStarted && "justify-center",
        )}
      >
        <div
          data-prompt-shell
          className="w-full max-w-full border border-zinc-200/80 bg-white shadow-[0_8px_24px_-10px_rgba(24,24,27,0.12)]"
          style={{ borderRadius: 22 }}
        >
          <div
            className={cn(
              "flex w-full",
              useCompact
                ? "min-h-[52px] flex-row items-center gap-2 px-2 py-1.5 sm:px-2.5"
                : "flex-col",
            )}
            data-prompt-layout={useCompact ? "compact" : "stacked"}
          >
            <div
              className={cn(
                "min-w-0",
                useCompact
                  ? "order-2 flex min-h-[32px] min-w-0 flex-1 items-center"
                  : "w-full px-2.5 pt-2 pb-0 sm:px-2.5",
              )}
              data-prompt-editor
            >
              <textarea
                ref={textareaRef}
                readOnly
                tabIndex={-1}
                value={value}
                placeholder="Ask anything"
                rows={1}
                className={cn(
                  "prompt-textarea block w-full resize-none overflow-hidden border-0 bg-transparent text-[14px] font-[430] leading-[20px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400",
                  useCompact
                    ? "m-0 h-5 min-h-[20px] max-h-5 px-0 py-0"
                    : "min-h-0 px-0 py-1",
                )}
              />
            </div>

            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-1.5 sm:gap-1.5 sm:px-2",
                useCompact && "contents",
              )}
            >
              <div className={cn(useCompact && "order-1")}>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Add content"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500"
                >
                  <Plus className="h-4 w-4 opacity-80" strokeWidth={1.75} />
                </button>
              </div>
              <div
                className={cn("min-w-0 flex-1", useCompact && "hidden")}
              />
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1",
                  useCompact && "order-3",
                )}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Dictate"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500"
                >
                  <Mic className="h-4 w-4 opacity-80" />
                </button>
                {isGenerating ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-demo-send
                    aria-label="Stop generating"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white transition-transform duration-150 ease-out"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-demo-send
                    aria-label="Send"
                    disabled={!hasDraft}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition-transform duration-150 ease-out",
                      !hasDraft && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isConversationStarted ? (
          <p className="mt-2 px-1 text-center text-[10.5px] leading-4 text-zinc-400">
            Clauxen can make mistakes. Check important info.
          </p>
        ) : null}
      </div>
    </div>
  );
});
