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
import { type ReactNode, useEffect, useState } from "react";
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

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeOfDayGreeting());

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section
      className={cn("relative flex min-h-0 flex-1 flex-col", className)}
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
            className={cn(
              "flex min-h-full w-full flex-col items-center",
              hasConversation && "pb-36 sm:pb-44",
            )}
          >
            {hasConversation ? (
              <div className="mx-auto w-full min-w-0 max-w-[768px] max-lg:px-[3px] lg:px-5 xl:px-6">
                {conversation}
              </div>
            ) : (
              <div className="relative flex min-h-[calc(100dvh-10.5rem)] w-full flex-1 flex-col items-center justify-center px-0 py-8 font-sans sm:min-h-[calc(100dvh-9rem)] sm:px-8 sm:py-14 md:px-10">
                <div className="flex w-full max-w-full flex-col items-center justify-center gap-4 sm:max-w-[min(720px,calc(100vw-3rem))] sm:gap-7">
                  <h2
                    className="select-none text-center font-handwriting text-[26px] leading-[34px] tracking-tight text-zinc-800 sm:text-[42px] sm:leading-[54px]"
                    suppressHydrationWarning
                  >
                    {greeting ? `${greeting}, Ujjwal` : "\u00a0"}
                  </h2>

                  <div className="w-full">{promptInput}</div>

                  <div className="flex min-h-[120px] w-full max-w-[640px] flex-col items-center justify-start">
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
                          className="mt-1 flex w-full flex-wrap justify-center gap-1.5 sm:mt-1.5 sm:gap-2"
                        >
                          {allChips.map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => onActiveChipChange(chip.label)}
                              className="flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-3 text-[13px] leading-5 text-zinc-600 transition-all duration-150 hover:bg-zinc-50 hover:text-zinc-900 sm:h-10 sm:gap-2 sm:px-4 sm:text-[14px] sm:leading-[21px]"
                            >
                              <chip.icon className="h-4 w-4 shrink-0 text-zinc-500 sm:h-5 sm:w-5" />
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
            <ChatFrostedEdge placement="bottom" isStreaming={isGenerating} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-[3px] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:pb-6 sm:pt-3">
            <div className="pointer-events-auto w-full min-w-0 max-w-full sm:max-w-[min(768px,calc(100vw-3rem))]">
              {promptInput}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
