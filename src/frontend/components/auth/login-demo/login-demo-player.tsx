"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatViewPane } from "@/frontend/components/chat-view-pane";
import { ConversationThread } from "@/frontend/components/conversation-thread";
import type { Message } from "@/frontend/lib/types";
import {
  DEMO_CHAT_TURNS,
  buildAssistantMessage,
  buildUserMessage,
} from "./chat-script";
import { DemoComposer } from "./demo-composer";
import { MacCursor } from "./mac-cursor";
import {
  findPromptShell,
  findPromptTextarea,
  pointInStage,
} from "./prompt-dom";
import { syncDemoStickyPins } from "./demo-sticky";
import { magnetCursorToSend } from "./send-magnet";

const IDLE_MS = 1100;
/** Smooth pointer travel — ease-in-out, not a hard cut. */
const MOVE_MS = 1100;
const CLICK_DOWN_MS = 140;
const CLICK_HOLD_MS = 160;
const CLICK_UP_MS = 180;
const BETWEEN_TURNS_MS = 1400;
const LOOP_PAUSE_MS = 2200;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Demo-only typing pace — natural (faster/slower) but snappier than before.
 * Main-app streaming is untouched: it follows real token arrival only.
 */
function naturalTypeDelayMs(char: string, prev: string): number {
  const base = 16 + Math.random() * 28; // ~16–44ms
  if (char === " ") return base * (0.45 + Math.random() * 0.3);
  if (/[.,!?;:]/.test(char)) return 55 + Math.random() * 90;
  if (char === "\n") return 90 + Math.random() * 110;
  // Occasional thinking hitch (rarer)
  if (Math.random() < 0.025) return 100 + Math.random() * 140;
  if (prev.length > 8 && !prev.includes(" ")) return base * 1.1;
  return base;
}

/** Demo-only reply stream — variable chunk speed (not used by main app). */
function naturalStreamStep(remaining: number): { size: number; delayMs: number } {
  const burst = Math.random();
  let size: number;
  let delayMs: number;
  if (burst < 0.14) {
    size = 2 + Math.floor(Math.random() * 2);
    delayMs = 70 + Math.random() * 90;
  } else if (burst < 0.5) {
    size = 3 + Math.floor(Math.random() * 5);
    delayMs = 32 + Math.random() * 36;
  } else {
    size = 5 + Math.floor(Math.random() * 8);
    delayMs = 16 + Math.random() * 24;
  }
  if (Math.random() < 0.06) delayMs += 80 + Math.random() * 120;
  return { size: Math.min(size, remaining), delayMs };
}

function noop() {}
async function noopAsync() {}

/**
 * Login product demo — ChatViewPane + ConversationThread + demo-only composer.
 * Isolated from real PromptInput so main-app typing is never affected.
 */
export function LoginDemoPlayer() {
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const promptHostRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef({ x: 90, y: 160 });
  const messagesRef = useRef<Message[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [cursor, setCursor] = useState({
    x: 90,
    y: 160,
    clicking: false,
    visible: false,
  });

  const isConversationStarted = messages.length > 0;
  const hasPromptDraft = draft.trim().length > 0;

  const resolveViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
  }, []);

  /** During stream: stay glued to bottom so the turn pair stays in view. */
  const stickDemoToBottom = useCallback(() => {
    const viewport = resolveViewport();
    if (!viewport) return;
    const prev = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    viewport.scrollTop = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight,
    );
    viewport.style.scrollBehavior = prev;
    // Demo-only: pin after scroll. Trailing rAF beats ConversationThread's
    // scroll-scheduled sync so main-app sticky logic stays untouched.
    syncDemoStickyPins(viewport);
    requestAnimationFrame(() => syncDemoStickyPins(viewport));
  }, [resolveViewport]);

  /**
   * On send: ease to bottom with the user bubble enter — natural, not a hard cut.
   * ponytail: per-frame ease is fine at 60fps; upgrade to time-based if needed.
   */
  const easeDemoToBottom = useCallback(
    (durationMs = 520) => {
      const viewport = resolveViewport();
      if (!viewport) return;
      const startTop = viewport.scrollTop;
      const endTop = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );
      if (Math.abs(endTop - startTop) < 1) return;

      const start = performance.now();
      const prev = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const e = easeInOutCubic(t);
        // Re-read end each frame — layout can grow as the bubble mounts.
        const liveEnd = Math.max(
          0,
          viewport.scrollHeight - viewport.clientHeight,
        );
        viewport.scrollTop = startTop + (liveEnd - startTop) * e;
        if (t < 1) requestAnimationFrame(tick);
        else viewport.style.scrollBehavior = prev;
      };
      requestAnimationFrame(tick);
    },
    [resolveViewport],
  );

  const lastMessageKey =
    messages[messages.length - 1]
      ? `${messages[messages.length - 1].id}:${messages[messages.length - 1].role}`
      : "empty";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /** After send: ease the new user turn into view with its enter animation. */
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role !== "user") return;
    easeDemoToBottom(560);
  }, [lastMessageKey, messages, easeDemoToBottom]);

  /** While streaming: keep the turn pair glued to the bottom every frame. */
  useEffect(() => {
    if (!isGenerating) return;
    let raf = 0;
    const tick = () => {
      stickDemoToBottom();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isGenerating, stickDemoToBottom]);

  useEffect(() => {
    if (!isGenerating) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    stickDemoToBottom();
  }, [messages, isGenerating, stickDemoToBottom]);

  /**
   * Demo-only sticky observers — ConversationThread sticky sync can lag / race
   * the scripted stream; re-assert pins without touching main-app code.
   */
  useEffect(() => {
    const viewport = resolveViewport();
    if (!viewport) return;

    let raf = 0;
    const run = () => {
      syncDemoStickyPins(viewport);
      // Second pass after ConversationThread's scroll rAF (same isolation rule).
      requestAnimationFrame(() => syncDemoStickyPins(viewport));
    };
    const schedule = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        run();
      });
    };

    schedule();
    viewport.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const content =
      (viewport.firstElementChild as HTMLElement | null) ?? viewport;
    const mo = new MutationObserver(schedule);
    mo.observe(content, {
      childList: true,
      subtree: true,
      // Re-assert when shared ConversationThread overwrites pin attrs.
      attributes: true,
      attributeFilter: [
        "data-sticky-active",
        "data-code-header-pin",
        "data-table-header-pin",
      ],
    });
    const ro = new ResizeObserver(schedule);
    ro.observe(content);

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mo.disconnect();
      ro.disconnect();
    };
  }, [resolveViewport, isConversationStarted, lastMessageKey]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const signal = { cancelled: false };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    const animate = (ms: number, onFrame: (t: number) => void) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const t = Math.min(1, (now - start) / ms);
          onFrame(t);
          if (t < 1) raf = requestAnimationFrame(tick);
          else resolve();
        };
        raf = requestAnimationFrame(tick);
      });

    const setCursorPos = (next: {
      x: number;
      y: number;
      clicking?: boolean;
      visible?: boolean;
    }) => {
      cursorPosRef.current = { x: next.x, y: next.y };
      setCursor((c) => ({
        x: next.x,
        y: next.y,
        clicking: next.clicking ?? c.clicking,
        visible: next.visible ?? c.visible,
      }));
    };

    const moveCursor = async (
      to: { x: number; y: number },
      duration = MOVE_MS,
    ) => {
      const from = { ...cursorPosRef.current };
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      // Scale duration with distance so short hops aren't sluggish / long ones aren't rushed
      const ms = Math.min(1600, Math.max(700, duration * (0.55 + dist / 420)));
      await animate(ms, (t) => {
        const e = easeInOutCubic(t);
        setCursorPos({
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          visible: true,
          clicking: false,
        });
      });
    };

    const promptRoot = () => promptHostRef.current;

    const clickAt = async (opts?: { pressSend?: boolean }) => {
      const sendBtn = opts?.pressSend
        ? (promptRoot()?.querySelector(
            '[data-demo-send][aria-label="Send"]:not([disabled]), [data-demo-send][aria-label="Stop generating"]',
          ) as HTMLElement | null)
        : null;

      setCursor((c) => ({ ...c, clicking: true }));
      if (sendBtn) {
        sendBtn.style.transform = "scale(0.88)";
        sendBtn.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,0.25)";
      }
      await wait(CLICK_DOWN_MS);
      if (cancelled) return;
      await wait(CLICK_HOLD_MS);
      if (cancelled) return;
      setCursor((c) => ({ ...c, clicking: false }));
      if (sendBtn) {
        sendBtn.style.transform = "scale(1)";
        sendBtn.style.boxShadow = "";
      }
      await wait(CLICK_UP_MS);
    };

    const typeDraft = async (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        const char = text[i - 1]!;
        const prevWord = text.slice(0, i).split(/\s+/).at(-1) ?? "";
        setDraft(text.slice(0, i));
        await wait(naturalTypeDelayMs(char, prevWord));
      }
    };

    const playTurn = async (turnIndex: number) => {
      const turn = DEMO_CHAT_TURNS[turnIndex]!;
      const stage = stageRef.current;
      const root = promptRoot();

      const shell = findPromptShell(root);
      const textarea = findPromptTextarea(root);
      await moveCursor(pointInStage(stage, shell ?? textarea, 0.38, 0.48));
      if (cancelled) return;
      await clickAt();
      if (cancelled) return;

      setActiveChip(null);
      await typeDraft(turn.prompt);
      if (cancelled) return;

      await wait(320);
      if (cancelled) return;

      // Brief pause so the glide to Send reads as intentional, not a hard cut.
      await wait(180);
      if (cancelled) return;

      await magnetCursorToSend({
        stage: stageRef.current,
        root: promptRoot(),
        getCursor: () => cursorPosRef.current,
        setCursor: setCursorPos,
        signal,
        settlePx: 2.5,
        timeoutMs: 4200,
      });
      if (cancelled) return;

      await wait(90);
      if (cancelled) return;
      await clickAt({ pressSend: true });
      if (cancelled) return;

      setCursor((c) => ({ ...c, visible: false }));

      const userMsg = buildUserMessage(turn, turnIndex);
      const assistantCreatedAt = Date.now();

      // Land user first so enter animation + eased scroll can play before stream.
      messagesRef.current = [...messagesRef.current, userMsg];
      setMessages(messagesRef.current);
      setDraft("");
      easeDemoToBottom(560);

      await wait(420);
      if (cancelled) return;

      const assistantPlaceholder = buildAssistantMessage(
        turn,
        turnIndex,
        "",
        true,
        assistantCreatedAt,
      );
      messagesRef.current = [...messagesRef.current, assistantPlaceholder];
      setMessages(messagesRef.current);
      setIsGenerating(true);
      stickDemoToBottom();

      await wait(220);
      if (cancelled) return;

      let cursor = 0;
      while (cursor < turn.reply.length) {
        if (cancelled) return;
        const { size, delayMs } = naturalStreamStep(
          turn.reply.length - cursor,
        );
        cursor = Math.min(turn.reply.length, cursor + size);
        const slice = turn.reply.slice(0, cursor);
        const prev = messagesRef.current;
        const next = prev.slice(0, -1);
        next.push(
          buildAssistantMessage(
            turn,
            turnIndex,
            slice,
            true,
            assistantCreatedAt,
          ),
        );
        messagesRef.current = next;
        setMessages(next);
        await wait(delayMs);
      }

      const finalPrev = messagesRef.current;
      const finalNext = finalPrev.slice(0, -1);
      finalNext.push(
        buildAssistantMessage(
          turn,
          turnIndex,
          turn.reply,
          false,
          assistantCreatedAt,
        ),
      );
      messagesRef.current = finalNext;
      setMessages(finalNext);
      setIsGenerating(false);
      requestAnimationFrame(() => stickDemoToBottom());
    };

    const run = async () => {
      while (!cancelled) {
        messagesRef.current = [];
        setMessages([]);
        setIsGenerating(false);
        setDraft("");
        setActiveChip(null);
        setCursorPos({ x: 90, y: 160, clicking: false, visible: false });
        const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
          "[data-radix-scroll-area-viewport]",
        );
        if (viewport) viewport.scrollTop = 0;

        await wait(IDLE_MS);
        if (cancelled) return;
        await wait(120);

        for (let i = 0; i < DEMO_CHAT_TURNS.length; i++) {
          if (cancelled) return;
          await playTurn(i);
          if (cancelled) return;
          if (i < DEMO_CHAT_TURNS.length - 1) {
            await wait(BETWEEN_TURNS_MS);
          }
        }

        await wait(LOOP_PAUSE_MS);
      }
    };

    void run();

    return () => {
      cancelled = true;
      signal.cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [stickDemoToBottom, easeDemoToBottom]);

  const promptInput = (
    <div ref={promptHostRef} className="pointer-events-none w-full">
      <DemoComposer
        value={draft}
        isGenerating={isGenerating}
        isConversationStarted={isConversationStarted}
      />
    </div>
  );

  return (
    <div
      ref={stageRef}
      className="login-demo-stage relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      aria-hidden
    >
      <div className="relative flex h-full min-h-0 w-full flex-col">
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF5F57]/90" />
          <span className="h-2 w-2 rounded-full bg-[#FEBC2E]/90" />
          <span className="h-2 w-2 rounded-full bg-[#28C840]/90" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatViewPane
            className="flex min-h-0 flex-1 flex-col bg-white"
            hasConversation={isConversationStarted}
            isGenerating={isGenerating}
            hasPromptDraft={hasPromptDraft}
            isAddMenuOpen={false}
            activeChip={activeChip}
            onActiveChipChange={setActiveChip}
            onSendMessage={noop}
            welcomeVariant="composer-only"
            scrollAreaRef={scrollAreaRef}
            conversation={
              <ConversationThread
                messages={messages}
                conversationKey="login-demo-chat"
                isFastScrolling={false}
                isGenerating={isGenerating}
                onSaveEditedMessage={noopAsync}
                onRetryUserMessage={noop}
                onRetryAssistant={noop}
                onSwitchBranch={noop}
                scrollAreaRef={scrollAreaRef}
              />
            }
            promptInput={promptInput}
          />
        </div>
      </div>

      <MacCursor
        x={cursor.x}
        y={cursor.y}
        clicking={cursor.clicking}
        visible={cursor.visible}
      />
    </div>
  );
}
