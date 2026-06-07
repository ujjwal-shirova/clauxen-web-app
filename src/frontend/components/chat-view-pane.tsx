"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code,
  FileSpreadsheet,
  FileText,
  Heart,
  ImagePlus,
  Microscope,
  PenTool,
  Plus,
  Presentation,
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
  /** New-chat-only image creation mode replaces the standard action chips. */
  isImageExploreMode?: boolean;
  onCreateImage?: () => void;
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
  { icon: ImagePlus, label: "Create an image", action: "image" },
  { icon: PenTool, label: "Write or edit" },
  { icon: Search, label: "Look something up" },
  { icon: BookOpen, label: "Learn" },
  { icon: Code, label: "Code" },
  { icon: Heart, label: "Life stuff" },
  { icon: Sparkles, label: "Clauxen's choice" },
  { icon: FileText, label: "Docs" },
  { icon: Presentation, label: "Slides" },
  { icon: FileSpreadsheet, label: "Excel" },
  { icon: Microscope, label: "Deep Research" },
] as const;

const imageIdeaCards = [
  {
    label: "Disco mode",
    background:
      "radial-gradient(circle at 48% 35%, rgba(247,250,255,.9) 0 7%, transparent 8%), radial-gradient(circle at 52% 42%, #c9d6e8 0 12%, transparent 13%), linear-gradient(135deg, #070a11, #242e3d 50%, #090b10)",
  },
  {
    label: "Improve Your Desk Setup",
    background:
      "linear-gradient(0deg, rgba(18,17,15,.5), transparent 60%), linear-gradient(135deg, #e3d2be 0%, #b59b80 35%, #46463e 57%, #92765b 100%)",
  },
  {
    label: "Wanderlust",
    background:
      "linear-gradient(0deg, rgba(30,28,26,.42), transparent 48%), linear-gradient(120deg, #cfa878, #eed9be 40%, #a7734b 63%, #ddc9a9)",
  },
  {
    label: "Scribble",
    background:
      "linear-gradient(0deg, rgba(12,23,20,.42), transparent 55%), linear-gradient(110deg, #e8e5e2 0 40%, #17443c 41% 65%, #141412 66%)",
  },
] as const;

export function ImageExploreIdeas({
  onIdeaClick,
  showHeader = true,
}: {
  onIdeaClick?: (label: string) => void;
  showHeader?: boolean;
} = {}) {
  return (
    <div className={cn("w-full font-sans", showHeader ? "pt-2" : "")}>
      {showHeader && (
        <div className="mb-4 flex items-center justify-between px-0.5 sm:mb-5">
          <h3 className="text-[20px] font-medium tracking-[-0.02em] text-zinc-900 sm:text-[24px]">
            Explore ideas
          </h3>
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden border-b border-dashed border-zinc-400 pb-0.5 text-[14px] text-zinc-500 sm:block">
              What&apos;s new
            </span>
            <button
              type="button"
              aria-label="Previous ideas"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:bg-black/[0.03] sm:h-11 sm:w-11"
            >
              <ChevronLeft className="icon-lg" />
            </button>
            <button
              type="button"
              aria-label="Next ideas"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-900 transition-colors hover:bg-black/[0.03] sm:h-11 sm:w-11"
            >
              <ChevronRight className="icon-lg" />
            </button>
          </div>
        </div>
      )}
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 sm:gap-3.5">
        <button
          type="button"
          className="flex h-[178px] w-[142px] shrink-0 flex-col items-center justify-between rounded-[22px] bg-zinc-100 pb-4 pt-14 text-zinc-600 transition-colors hover:bg-zinc-200 sm:h-[202px] sm:w-[158px]"
        >
          <Plus className="h-8 w-8 stroke-[1.4]" />
          <span className="text-[14px] font-normal sm:text-[15px]">
            Upload a photo
          </span>
        </button>
        {imageIdeaCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onIdeaClick?.(card.label)}
            className="relative h-[178px] w-[142px] shrink-0 overflow-hidden rounded-[22px] text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 sm:h-[202px] sm:w-[158px]"
            style={{ backgroundImage: card.background }}
          >
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-3 pt-10 text-[15px] leading-5 text-white sm:text-[16px]">
              {card.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

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
  isImageExploreMode = false,
  onCreateImage,
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
              hasConversation && "pb-40 sm:pb-44",
            )}
          >
            {hasConversation ? (
              <div className="mx-auto w-full min-w-0 max-w-[768px] px-4 sm:px-5 md:px-6">
                {conversation}
              </div>
            ) : (
              <div className="relative flex min-h-[calc(100dvh-11rem)] w-full flex-1 flex-col items-center justify-center px-4 py-10 font-sans sm:min-h-[calc(100dvh-9rem)] sm:px-8 sm:py-14 md:px-10">
                <div className="flex w-full max-w-[min(720px,calc(100vw-2rem))] flex-col items-center justify-center gap-5 sm:max-w-[min(720px,calc(100vw-3rem))] sm:gap-7">
                  <h2 className="select-none text-center font-handwriting text-[28px] leading-[38px] tracking-tight text-zinc-800 sm:text-[42px] sm:leading-[54px]">
                    {greeting ? `${greeting}, Ujjwal` : "\u00a0"}
                  </h2>

                  <div className="w-full">{promptInput}</div>

                  <div
                    className={cn(
                      "flex min-h-[120px] w-full flex-col items-center justify-start transition-[max-width] duration-300",
                      isImageExploreMode ? "max-w-[960px]" : "max-w-[640px]",
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {!hasPromptDraft && isImageExploreMode ? (
                        <motion.div
                          key="image-explore-ideas"
                          initial={{ opacity: 0, y: 12, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.985 }}
                          transition={{
                            duration: 0.3,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="w-full"
                        >
                          <ImageExploreIdeas />
                        </motion.div>
                      ) : !hasPromptDraft && activeChip ? (
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
                          className="mt-1.5 flex w-full flex-wrap justify-center gap-1.5 sm:gap-2"
                        >
                          {allChips.map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => {
                                if (
                                  "action" in chip &&
                                  chip.action === "image"
                                ) {
                                  onCreateImage?.();
                                  return;
                                }
                                onActiveChipChange(chip.label);
                              }}
                              className="flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-transparent px-3.5 text-[14px] leading-[21px] text-zinc-600 transition-all duration-150 hover:bg-zinc-50 hover:text-zinc-900 sm:px-4"
                            >
                              <chip.icon className="h-5 w-5 shrink-0 text-zinc-500" />
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
        <ChatFrostedEdge placement="bottom" isStreaming={isGenerating} />
      ) : null}

      {hasConversation ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-6 md:px-8">
          <div className="pointer-events-auto w-full min-w-0 max-w-[min(768px,calc(100vw-2rem))] sm:max-w-[min(768px,calc(100vw-3rem))]">
            {promptInput}
          </div>
        </div>
      ) : null}
    </section>
  );
}
