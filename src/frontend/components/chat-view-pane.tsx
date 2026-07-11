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
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { cn } from "@/frontend/lib/utils";
import { useAuth } from "@/frontend/hooks/use-auth";
import { greetingFirstName } from "@/lib/profile-names";
import { ChatFrostedEdge } from "./ui/chat-frosted-edge";
import { PromptSuggestions } from "./prompt-suggestions";

interface ChatViewPaneProps {
  hasConversation: boolean;
  isGenerating?: boolean;
  /** When true, quick action chips stay hidden (reserved space) so the welcome block does not shift. */
  hasPromptDraft: boolean;
  /** When true, the + menu is open — welcome chips hide with transition. */
  isAddMenuOpen?: boolean;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onSendMessage: (prompt: string) => void;
  promptInput: ReactNode;
  conversation: ReactNode;
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  /**
   * Welcome empty-state mode.
   * `composer-only` — centered greeting + prompt + chips. Used by login demo.
   */
  welcomeVariant?: "default" | "composer-only";
  /** Optional override; defaults to preferred name from session. */
  userPreferredName?: string | null;
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

/** First name for welcome — prefers what Clauxen calls you, then full name. */
function welcomeFirstName(input: {
  preferredName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string | null {
  return greetingFirstName(input);
}

/** Baseline reserve — actual value tracks measured composer height. */
const MIN_CHAT_COMPOSER_RESERVE_PX = 84;
const MIN_CHAT_COMPOSER_RESERVE_PX_DESKTOP = 96;
const CHAT_COMPOSER_RESERVE_BUFFER_PX = 6;
const CHAT_FROSTED_EDGE_EXTRA_PX = 16;
/** When within this distance of the bottom, composer padding growth follows scroll. */
const COMPOSER_SCROLL_FOLLOW_THRESHOLD_PX = 96;

function maxScrollTop(viewport: HTMLElement) {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

function getMinComposerReservePx() {
  if (typeof window === "undefined") return MIN_CHAT_COMPOSER_RESERVE_PX_DESKTOP;
  return window.matchMedia("(min-width: 640px)").matches
    ? MIN_CHAT_COMPOSER_RESERVE_PX_DESKTOP
    : MIN_CHAT_COMPOSER_RESERVE_PX;
}

function resolveScrollViewport(
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>,
) {
  const root = scrollAreaRef?.current;
  if (!root) return null;
  return root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
}

export function ChatViewPane({
  hasConversation,
  isGenerating = false,
  hasPromptDraft,
  isAddMenuOpen = false,
  activeChip,
  onActiveChipChange,
  onSendMessage,
  promptInput,
  conversation,
  scrollAreaRef,
  className,
  welcomeVariant = "default",
  userPreferredName,
}: ChatViewPaneProps) {
  const { user } = useAuth();
  const composerOnlyWelcome = welcomeVariant === "composer-only";
  const [greeting, setGreeting] = useState<string | null>(null);
  const firstName = welcomeFirstName({
    preferredName: userPreferredName ?? user?.preferredName,
    fullName: user?.displayName,
    email: user?.email,
  });
  const [composerReservePx, setComposerReservePx] = useState(() =>
    getMinComposerReservePx(),
  );
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const composerMeasureRef = useRef<HTMLDivElement>(null);
  const composerReserveRef = useRef(getMinComposerReservePx());
  const composerMeasureRafRef = useRef(0);

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeOfDayGreeting());

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (hasConversation) return;
    const minReserve = getMinComposerReservePx();
    composerReserveRef.current = minReserve;
    setComposerReservePx(minReserve);
  }, [hasConversation]);

  useEffect(() => {
    if (!hasConversation) return;

    const minReserve = getMinComposerReservePx();
    composerReserveRef.current = minReserve;
    setComposerReservePx(minReserve);

    const composer = composerMeasureRef.current;
    if (!composer) return;

    const applyComposerReserve = (composerHeight: number) => {
      const minReserve = getMinComposerReservePx();
      const nextReserve = Math.max(
        minReserve,
        Math.ceil(composerHeight) + CHAT_COMPOSER_RESERVE_BUFFER_PX,
      );
      const prevReserve = composerReserveRef.current;
      const delta = nextReserve - prevReserve;

      if (delta === 0) return;

      composerReserveRef.current = nextReserve;
      setComposerReservePx(nextReserve);

      const viewport = resolveScrollViewport(scrollAreaRef);
      if (viewport && delta !== 0) {
        const distanceFromBottom =
          maxScrollTop(viewport) - viewport.scrollTop;
        if (distanceFromBottom <= COMPOSER_SCROLL_FOLLOW_THRESHOLD_PX) {
          viewport.scrollTop = Math.max(0, viewport.scrollTop + delta);
        }
      }
    };

    const measureComposer = () => {
      cancelAnimationFrame(composerMeasureRafRef.current);
      composerMeasureRafRef.current = requestAnimationFrame(() => {
        const height =
          composer.getBoundingClientRect().height ||
          composer.offsetHeight ||
          MIN_CHAT_COMPOSER_RESERVE_PX;
        applyComposerReserve(height);
      });
    };

    measureComposer();

    const observer = new ResizeObserver(() => {
      measureComposer();
    });
    observer.observe(composer);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(composerMeasureRafRef.current);
    };
  }, [hasConversation, scrollAreaRef]);

  return (
    <section
      className={cn(
        "agent-panel-conversation-shell relative flex min-h-0 flex-1 flex-col",
        className,
      )}
      data-chat-active={hasConversation || undefined}
      data-chat-streaming={isGenerating || undefined}
      style={
        hasConversation
          ? ({
              "--chat-composer-reserve": `${composerReservePx}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          className="h-full min-h-0 min-w-0 flex-1 overflow-hidden"
          ref={scrollAreaRef}
        >
          <div
            ref={scrollContentRef}
            className={cn(
              "chat-scroll-content flex w-full flex-1 flex-col items-center",
              !hasConversation && "min-h-full",
            )}
            style={
              hasConversation
                ? {
                    paddingBottom:
                      "var(--chat-composer-reserve, 84px)",
                  }
                : undefined
            }
          >
            {hasConversation ? (
              <div className="chat-column w-full min-w-0">
                {conversation}
              </div>
            ) : (
              <div
                className={cn(
                  "relative flex w-full flex-col items-center justify-center",
                  // Demo welcome: fill the pane and center greeting + composer.
                  composerOnlyWelcome
                    ? "absolute inset-0 min-h-0 px-1 py-3"
                    : "min-h-[calc(100dvh-10.5rem)] flex-1 py-6 sm:min-h-[calc(100dvh-9rem)] sm:py-10",
                )}
                data-demo-welcome={composerOnlyWelcome || undefined}
              >
                <div
                  className={cn(
                    "chat-column flex w-full min-w-0 flex-col items-center",
                    "gap-3 sm:gap-5",
                  )}
                >
                  <h2
                    className={cn(
                      "select-none text-center font-handwriting tracking-tight text-zinc-800",
                      composerOnlyWelcome
                        ? "text-[22px] leading-[30px] sm:text-[32px] sm:leading-[40px]"
                        : "text-[24px] leading-[32px] sm:text-[38px] sm:leading-[48px]",
                    )}
                    suppressHydrationWarning
                  >
                    {composerOnlyWelcome
                      ? "What can I help with?"
                      : greeting
                        ? firstName
                          ? `${greeting}, ${firstName}`
                          : greeting
                        : "\u00a0"}
                  </h2>

                  <div className="w-full">{promptInput}</div>

                  {/* Welcome action chips — same strip as main-app new chat. */}
                  <div
                    className={cn(
                      "flex w-full max-w-[620px] flex-col items-center justify-start transition-[min-height] duration-200 ease-out",
                      !isAddMenuOpen && "min-h-[96px]",
                      composerOnlyWelcome && "min-h-0",
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {!hasPromptDraft && !isAddMenuOpen && activeChip ? (
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
                      ) : !hasPromptDraft && !isAddMenuOpen ? (
                        <motion.div
                          key="chips"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            "mt-1 flex w-full flex-wrap justify-center gap-1.5 sm:mt-1.5 sm:gap-1.5",
                            composerOnlyWelcome && "gap-1 sm:gap-1",
                          )}
                        >
                          {allChips.map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => onActiveChipChange(chip.label)}
                              className={cn(
                                "flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-3 text-[12.5px] leading-5 text-zinc-600 transition-all duration-150 hover:bg-zinc-50 hover:text-zinc-900 sm:h-8 sm:gap-1.5 sm:px-3.5 sm:text-[13px] sm:leading-[20px]",
                                composerOnlyWelcome &&
                                  "h-7 px-2.5 text-[11.5px] sm:h-7 sm:px-2.5 sm:text-[12px]",
                              )}
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
                  style={{
                    height: `calc(var(--chat-composer-reserve, ${MIN_CHAT_COMPOSER_RESERVE_PX}px) + ${CHAT_FROSTED_EDGE_EXTRA_PX}px)`,
                  }}
                />
              </div>
            </div>
          </div>
          <div
            ref={composerMeasureRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pt-2.5 sm:pb-4"
            data-composer-dock
          >
            <div className="chat-composer-row">
              <div className="chat-composer-row__main">
                <div className="chat-column pointer-events-auto">
                  {promptInput}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
