"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { greetingFirstName } from "@/lib/profile-names";
import { ChatFrostedEdge } from "./ui/chat-frosted-edge";
import { PromptSuggestions } from "./prompt-suggestions";

interface ChatViewPaneProps {
  hasConversation: boolean;
  isGenerating?: boolean;
  /** When true, quick action chips stay hidden while the user is typing a draft. */
  hasPromptDraft: boolean;
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
   * `incognito` — You're incognito greeting, no chips, privacy footer.
   */
  welcomeVariant?: "default" | "composer-only" | "incognito";
  /** Optional override; defaults to preferred name from session. */
  userPreferredName?: string | null;
  onUpgradeClick?: () => void;
  /** Free-plan upgrade card shown only on the blank `/new` welcome route. */
  showNewChatUpgradeCard?: boolean;
};

const allChips = [
  { icon: PenTool, label: "Write or edit" },
  { icon: Search, label: "Look something up" },
  { icon: BookOpen, label: "Learn" },
  { icon: Code, label: "Code" },
  { icon: Heart, label: "Life stuff" },
  { icon: Sparkles, label: "Clauxen's choice" },
  { icon: Microscope, label: "Deep Research" },
] as const;

/** Welcome suggestion chips + expanded suggestion card (new-chat hero + demos). */
function WelcomeChips({
  hasPromptDraft,
  activeChip,
  onActiveChipChange,
  onSendMessage,
  compact = false,
}: {
  hasPromptDraft: boolean;
  activeChip: string | null;
  onActiveChipChange: (chip: string | null) => void;
  onSendMessage: (prompt: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-start transition-[min-height] duration-200 ease-out",
        compact ? "min-h-0" : "min-h-[72px]",
      )}
    >
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
            className={cn(
              "flex w-full flex-wrap justify-center gap-1.5",
              compact && "gap-1",
            )}
          >
            {allChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onActiveChipChange(chip.label)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[8px] border border-[var(--ui-border)] bg-transparent px-2.5 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)] transition-colors duration-150 hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
                  compact && "h-6 gap-1 px-2 text-[11.5px]",
                )}
              >
                <chip.icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>{chip.label}</span>
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const NAMED_WELCOMES = [
  (name: string) => `What are we thinking about, ${name}?`,
  (name: string) => `Where should we begin, ${name}?`,
  (name: string) => `What's on your mind, ${name}?`,
  (name: string) => `What should we work on, ${name}?`,
  (name: string) => `Good to see you, ${name}.`,
  (name: string) => `What can I help with, ${name}?`,
  (name: string) => `Ready when you are, ${name}.`,
  (name: string) => `What's the plan today, ${name}?`,
] as const;

const UNNAMED_WELCOMES = [
  "What are we thinking about?",
  "Where should we begin?",
  "What can I help with?",
  "What's on your mind?",
  "What should we explore?",
] as const;

function pickWelcomeMessage(name: string | null) {
  const hour = new Date().getHours();
  const time =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const pool: string[] = [
    ...UNNAMED_WELCOMES,
    name ? `${time}, ${name}.` : `${time}.`,
  ];
  if (name) {
    for (const line of NAMED_WELCOMES) pool.push(line(name));
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? UNNAMED_WELCOMES[0];
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
const CHAT_COMPOSER_RESERVE_BUFFER_PX = 8;
const CHAT_FROSTED_EDGE_EXTRA_PX = 12;
/** Ignore sub-pixel / 1px thrash from font metrics while typing. */
const COMPOSER_RESERVE_EPSILON_PX = 2;

function getMinComposerReservePx() {
  if (typeof window === "undefined") return MIN_CHAT_COMPOSER_RESERVE_PX_DESKTOP;
  return window.matchMedia("(min-width: 640px)").matches
    ? MIN_CHAT_COMPOSER_RESERVE_PX_DESKTOP
    : MIN_CHAT_COMPOSER_RESERVE_PX;
}

/**
 * Composer measurement owns layout only. The chat scroll hook is the sole
 * owner of vertical position, preventing competing scrollTop writes.
 */
function applyComposerReserveCss(
  shell: HTMLElement,
  reservePx: number,
) {
  shell.style.setProperty("--chat-composer-reserve", `${reservePx}px`);
  const spacer = shell.querySelector<HTMLElement>("[data-composer-end-spacer]");
  if (spacer) {
    spacer.style.height = `${reservePx}px`;
  }

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
  className,
  welcomeVariant = "default",
  userPreferredName,
  onUpgradeClick,
  showNewChatUpgradeCard = false,
}: ChatViewPaneProps) {
  const { user, loading: authLoading } = useAuth();
  const composerOnlyWelcome = welcomeVariant === "composer-only";
  const incognitoWelcome = welcomeVariant === "incognito";
  // Blank new-chat landing — centered hero (icon + greeting + composer + chips).
  // Once a conversation exists the composer docks to the bottom instead.
  const centeredWelcome =
    !hasConversation && !composerOnlyWelcome && !incognitoWelcome;
  const dockComposer = hasConversation;
  const [greeting, setGreeting] = useState<string | null>(null);
  const welcomePickedRef = useRef(false);
  const firstName = welcomeFirstName({
    preferredName: userPreferredName ?? user?.preferredName,
    fullName: user?.displayName,
    email: user?.email,
  });
  const shellRef = useRef<HTMLElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const composerMeasureRef = useRef<HTMLDivElement>(null);
  const composerReserveRef = useRef(getMinComposerReservePx());
  const composerMeasureRafRef = useRef(0);

  useEffect(() => {
    if (welcomePickedRef.current || authLoading) return;
    welcomePickedRef.current = true;
    setGreeting(pickWelcomeMessage(firstName));
  }, [authLoading, firstName]);

  useEffect(() => {
    if (dockComposer) return;
    const minReserve = getMinComposerReservePx();
    composerReserveRef.current = minReserve;
    if (shellRef.current) {
      applyComposerReserveCss(shellRef.current, minReserve);
    }
  }, [dockComposer, scrollAreaRef]);

  useEffect(() => {
    if (!dockComposer) return;
    const shell = shellRef.current;
    const composer = composerMeasureRef.current;
    if (!shell || !composer) return;

    const minReserve = getMinComposerReservePx();
    composerReserveRef.current = minReserve;
    applyComposerReserveCss(shell, minReserve);

    const measureComposer = () => {
      cancelAnimationFrame(composerMeasureRafRef.current);
      composerMeasureRafRef.current = requestAnimationFrame(() => {
        const height =
          composer.getBoundingClientRect().height ||
          composer.offsetHeight ||
          MIN_CHAT_COMPOSER_RESERVE_PX;
        const nextReserve = Math.max(
          getMinComposerReservePx(),
          Math.ceil(height) + CHAT_COMPOSER_RESERVE_BUFFER_PX,
        );
        const prevReserve = composerReserveRef.current;
        if (Math.abs(nextReserve - prevReserve) < COMPOSER_RESERVE_EPSILON_PX) {
          return;
        }
        composerReserveRef.current = nextReserve;
        applyComposerReserveCss(shell, nextReserve);
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
  }, [dockComposer, scrollAreaRef]);

  return (
    <section
      ref={shellRef}
      className={cn(
        "agent-panel-conversation-shell relative flex min-h-0 flex-1 flex-col",
        className,
      )}
      data-chat-active={hasConversation || undefined}
      data-chat-streaming={isGenerating || undefined}
      style={
        dockComposer
          ? ({
              "--chat-composer-reserve": `${composerReserveRef.current}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {!hasConversation && !composerOnlyWelcome && !incognitoWelcome ? (
        <div className="new-chat-hero flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="new-chat-hero__inner m-auto flex w-full flex-col items-center px-4 py-6 sm:px-6">
            <h2
              className="new-chat-greeting w-full max-w-full text-center text-[var(--ui-fg)]"
              suppressHydrationWarning
            >
              <Image
                src="/assets/icons/clauxen-icon.png"
                width={28}
                height={28}
                alt=""
                aria-hidden="true"
                priority
                className="new-chat-greeting__mark"
              />
              {greeting || "\u00a0"}
            </h2>
            <div className="w-full">{promptInput}</div>
            <div className="w-full">
              <WelcomeChips
                hasPromptDraft={hasPromptDraft}
                activeChip={activeChip}
                onActiveChipChange={onActiveChipChange}
                onSendMessage={onSendMessage}
              />
            </div>
            <p className="text-center text-[11px] leading-4 text-[var(--ui-fg-subtle)]">
              Clauxen can make mistakes. Check important info.
            </p>
          </div>
        </div>
      ) : (
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
          >
            {hasConversation ? (
              <div className="chat-column w-full min-w-0">
                {conversation}
                {/*
                  End spacer clears the absolute composer without padding the
                  whole scroll content. Height is driven by CSS var / direct DOM
                  writes so transcript React trees do not re-layout on every
                  composer resize (that was causing the upward jump).
                */}
                <div
                  aria-hidden
                  data-composer-end-spacer
                  className="pointer-events-none w-full shrink-0"
                  style={{
                    height: `var(--chat-composer-reserve, ${MIN_CHAT_COMPOSER_RESERVE_PX}px)`,
                  }}
                />
              </div>
            ) : (
              <div
                className={cn(
                  "relative flex w-full flex-col items-center justify-center",
                  // Demo welcome: fill the pane and center greeting + composer.
                  composerOnlyWelcome
                    ? "absolute inset-0 min-h-0 px-1 py-3"
                    : "min-h-full flex-1 px-3 py-5 sm:min-h-[calc(100dvh-9rem)] sm:px-0 sm:py-10",
                )}
                data-demo-welcome={composerOnlyWelcome || undefined}
              >
                <div
                  className={cn(
                    "chat-column flex w-full min-w-0 flex-col items-center",
                    "gap-3 sm:gap-6",
                  )}
                >
                  {showNewChatUpgradeCard ? (
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#f6f6f4] px-3 text-[14px] font-normal leading-5 text-[#898781] transition-colors hover:bg-[#f1f1ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
                    >
                      <span className="text-[var(--link)] underline decoration-[var(--link-decoration)] underline-offset-[3px]">
                        Upgrade to Pro
                      </span>
                    </button>
                  ) : null}

                  {incognitoWelcome ? (
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className="inline-flex items-center rounded-full border border-zinc-200/90 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                    >
                      Upgrade to Pro
                    </button>
                  ) : null}

                  <h2
                    className={cn(
                      "select-none text-center tracking-tight text-zinc-800",
                      incognitoWelcome
                        ? "font-handwriting text-[22px] leading-[30px] sm:text-[38px] sm:leading-[48px]"
                        : "font-handwriting",
                      !incognitoWelcome &&
                        (composerOnlyWelcome
                          ? "text-[22px] leading-[30px] sm:text-[38px] sm:leading-[46px]"
                          : "text-[22px] leading-[1.2] max-[380px]:text-[20px] sm:text-[36px] sm:leading-[44px] lg:text-[44px] lg:leading-[52px]"),
                    )}
                    suppressHydrationWarning
                  >
                    {incognitoWelcome ? (
                      <span className="inline-flex items-center gap-2.5">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center text-[22px] leading-none text-[#e8a03c] sm:h-8 sm:w-8 sm:text-[26px]"
                          aria-hidden
                        >
                          ✦
                        </span>
                        You&apos;re incognito
                      </span>
                    ) : composerOnlyWelcome ? (
                      "What can I help with?"
                    ) : greeting ? (
                      greeting
                    ) : (
                      "\u00a0"
                    )}
                  </h2>

                  <div className="w-full">{promptInput}</div>

                  {incognitoWelcome ? (
                    <div className="mt-1 flex w-full max-w-[var(--chat-column-max-width,720px)] flex-col items-center gap-1.5 px-4 text-center">
                      <p className="text-[12.5px] leading-5 text-zinc-500">
                        Incognito chats aren&apos;t saved, added to memory, or
                        used to train models.
                      </p>
                      <a
                        href="/legal/privacy"
                        className="text-[12.5px] leading-5 text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-700"
                      >
                        Learn more about how your data is used.
                      </a>
                    </div>
                  ) : (
                  /* Welcome action chips — same strip as main-app new chat. */
                  <div className="w-full max-w-[var(--chat-column-max-width,720px)]">
                    <WelcomeChips
                      hasPromptDraft={hasPromptDraft}
                      activeChip={activeChip}
                      onActiveChipChange={onActiveChipChange}
                      onSendMessage={onSendMessage}
                      compact={composerOnlyWelcome}
                    />
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      )}

      {dockComposer ? (
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
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-3 sm:pb-6"
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
