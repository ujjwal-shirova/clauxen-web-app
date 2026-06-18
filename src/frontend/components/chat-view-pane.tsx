"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Code,
  Heart,
  Microscope,
  PenTool,
  Search,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { cn } from "@/frontend/lib/utils";
import { ChatFrostedEdge } from "./ui/chat-frosted-edge";
import { PromptSuggestions } from "./prompt-suggestions";

interface ChatViewPaneProps {
  hasConversation: boolean;
  isGenerating?: boolean;
  /** When true, quick action chips stay hidden (reserved space) so the welcome block does not shift. */
  hasPromptDraft: boolean;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onSendMessage: (prompt: string) => void;
  promptInput: ReactNode;
  conversation: ReactNode;
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>;
  messageNavigator?: ReactNode;
  className?: string;
}

const allChips = [
  { icon: PenTool, label: "Write or edit" },
  { icon: Search, label: "Look something up" },
  { icon: BookOpen, label: "Learn" },
  { icon: Code, label: "Code" },
  { icon: Heart, label: "Life stuff" },
  { icon: Sparkles, label: "Clauxen's choice" },
  { icon: Microscope, label: "Deep Research" },
] as const;

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function ChatViewPane({
  hasConversation,
  isGenerating = false,
  hasPromptDraft,
  activeChip,
  onActiveChipChange,
  onSendMessage,
  promptInput,
  conversation,
  scrollAreaRef,
  messageNavigator,
  className,
}: ChatViewPaneProps) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(120);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputHeightRafRef = useRef(0);

  useEffect(() => {
    const el = inputContainerRef.current;
    if (!el || !hasConversation) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        const rounded = Math.ceil(height);
        cancelAnimationFrame(inputHeightRafRef.current);
        inputHeightRafRef.current = requestAnimationFrame(() => {
          setInputHeight((prev) =>
            Math.abs(prev - rounded) < 16 ? prev : rounded,
          );
        });
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(inputHeightRafRef.current);
    };
  }, [hasConversation]);

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeOfDayGreeting());

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section
      className={cn(
        "agent-panel-conversation-shell relative flex min-h-0 flex-1 flex-col",
        className,
      )}
      data-chat-active={hasConversation || undefined}
      data-chat-streaming={isGenerating || undefined}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          className="h-full min-h-0 min-w-0 flex-1 overflow-hidden"
          ref={scrollAreaRef}
          railEnd={hasConversation ? messageNavigator : undefined}
        >
          <div
            className="flex min-h-full w-full flex-col items-center"
            style={
              hasConversation
                ? { paddingBottom: `${inputHeight + 10}px` }
                : undefined
            }
          >
            {hasConversation ? (
              <div className="chat-column w-full min-w-0">
                {conversation}
              </div>
            ) : (
              <div className="relative flex min-h-[calc(100dvh-10.5rem)] w-full flex-1 flex-col items-center justify-center py-6 sm:min-h-[calc(100dvh-9rem)] sm:py-10">
                <div className="chat-column flex w-full min-w-0 flex-col items-center gap-3 sm:gap-5">
                  <h2
                    className="select-none text-center font-handwriting text-[24px] leading-[32px] tracking-tight text-zinc-800 sm:text-[38px] sm:leading-[48px]"
                    suppressHydrationWarning
                  >
                    {greeting ? `${greeting}, Ujjwal` : "\u00a0"}
                  </h2>

                  <div className="w-full">{promptInput}</div>

                  <div className="flex min-h-[96px] w-full max-w-[620px] flex-col items-center justify-start">
                    <AnimatePresence mode="wait" initial={false}>
                      {!hasPromptDraft && activeChip ? (
                        <motion.div
                          key={`suggestions-${activeChip}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="w-full"
                        >
                          <PromptSuggestions
                            category={activeChip}
                            onClose={() => onActiveChipChange(null)}
                            onSelect={(suggestion) => {
                              onSendMessage(suggestion);
                              onActiveChipChange(null);
                            }}
                          />
                        </motion.div>
                      ) : !hasPromptDraft ? (
                        <motion.div
                          key="chips"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="mt-1 flex w-full flex-wrap justify-center gap-1.5 sm:mt-1.5 sm:gap-1.5"
                        >
                          {allChips.map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => onActiveChipChange(chip.label)}
                              className="flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-3 text-[12.5px] leading-5 text-zinc-600 transition-all duration-150 hover:bg-zinc-50 hover:text-zinc-900 sm:h-8 sm:gap-1.5 sm:px-3.5 sm:text-[13px] sm:leading-[20px]"
                            >
                              <chip.icon className="h-4 w-4 shrink-0 text-zinc-500" />
                              <span>{chip.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {hasConversation ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
            <div className="chat-composer-row">
              <div className="chat-composer-row__main relative">
                <ChatFrostedEdge
                  placement="bottom"
                  isStreaming={isGenerating}
                  style={{ height: `${inputHeight + 18}px` }}
                />
              </div>
              <div
                className="chat-message-navigator-rail hidden md:block"
                aria-hidden
              />
            </div>
          </div>
          <div
            ref={inputContainerRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 sm:pb-4 sm:pt-2.5"
          >
            <div className="chat-composer-row">
              <div className="chat-composer-row__main">
                <div className="chat-column pointer-events-auto">
                  {promptInput}
                </div>
              </div>
              <div
                className="chat-message-navigator-rail hidden md:block"
                aria-hidden
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
