"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { greetingFirstName } from "@/lib/profile-names";
import { ChatFrostedEdge } from "./ui/chat-frosted-edge";
import { ClauxenLogo } from "./icons/clauxen-logo";

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
            <div className="flex flex-col items-center gap-3.5 text-center">
              <ClauxenLogo
                size={40}
                className="text-zinc-400 dark:text-zinc-500 transition-colors"
              />
              <h2
                className="new-chat-greeting w-full max-w-full text-center text-[var(--ui-fg)]"
                suppressHydrationWarning
              >
                {greeting || "\u00a0"}
              </h2>
            </div>
            <div className="w-full">{promptInput}</div>
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
                      className="free-plan-upgrade free-plan-upgrade--card outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
                    >
                      Free plan <span aria-hidden>·</span>{" "}
                      <span className="free-plan-upgrade__action">Upgrade</span>
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

                  {composerOnlyWelcome ? (
                    <ClauxenLogo
                      size={40}
                      className="text-zinc-400 dark:text-zinc-500 transition-colors"
                    />
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
                  ) : null}
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
