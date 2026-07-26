"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatViewPane } from "@/components/chat-view-pane";
import { ConversationThread } from "@/components/conversation-thread";
import type { Message } from "@/lib/types";
import {
  DEMO_AGENT_KEYFRAMES,
  DEMO_AGENT_TURN,
  DEMO_FILES_TURN,
  DEMO_SCENES,
  applyAgentDemoKeyframe,
  buildStreamingAgentAssistant,
  buildAssistantMessage,
  buildUserMessage,
} from "./chat-script";
import { DemoComposer } from "./demo-composer";
import {
  DEMO_DRAG_FILE_IDS,
  DEMO_FINDER_FILES,
  type DemoAttachment,
} from "./demo-files";
import { DemoDragGhost, DemoFinder } from "./demo-finder";
import { DemoSceneLabel } from "./demo-scene-label";
import { MacCursor } from "./mac-cursor";
import {
  findPromptShell,
  findPromptTextarea,
  pointInStage,
} from "./prompt-dom";
import { syncDemoStickyPins } from "./demo-sticky";
import { magnetCursorToSend } from "./send-magnet";

const IDLE_MS = 700;
const MOVE_MS = 1100;
const CLICK_DOWN_MS = 140;
const CLICK_HOLD_MS = 160;
const CLICK_UP_MS = 180;
const SLIDE_MS = 720;
const LABEL_HOLD_MS = 2400;
const LOOP_PAUSE_MS = 2000;
const GROW_MS = 780;
const HOLD_AFTER_AGENT_MS = 2800;
const HOLD_AFTER_FILES_MS = 2200;

type Scene =
  | "label-agent"
  | "chat-agent"
  | "label-files"
  | "chat-files";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function naturalTypeDelayMs(char: string, prev: string): number {
  const base = 14 + Math.random() * 24;
  if (char === " ") return base * (0.45 + Math.random() * 0.3);
  if (/[.,!?;:]/.test(char)) return 48 + Math.random() * 70;
  if (char === "\n") return 80 + Math.random() * 100;
  if (Math.random() < 0.02) return 90 + Math.random() * 120;
  if (prev.length > 8 && !prev.includes(" ")) return base * 1.08;
  return base;
}

function naturalStreamStep(remaining: number): { size: number; delayMs: number } {
  const burst = Math.random();
  let size: number;
  let delayMs: number;
  if (burst < 0.14) {
    size = 2 + Math.floor(Math.random() * 2);
    delayMs = 60 + Math.random() * 80;
  } else if (burst < 0.5) {
    size = 3 + Math.floor(Math.random() * 5);
    delayMs = 28 + Math.random() * 32;
  } else {
    size = 5 + Math.floor(Math.random() * 8);
    delayMs = 14 + Math.random() * 22;
  }
  if (Math.random() < 0.05) delayMs += 70 + Math.random() * 100;
  return { size: Math.min(size, remaining), delayMs };
}

function streamThinkingText(
  full: string,
  onSlice: (slice: string) => void,
  wait: (ms: number) => Promise<void>,
  signal: { cancelled: boolean },
) {
  return (async () => {
    let i = 0;
    while (i < full.length) {
      if (signal.cancelled) return;
      const { size, delayMs } = naturalStreamStep(full.length - i);
      i = Math.min(full.length, i + size);
      onSlice(full.slice(0, i));
      await wait(delayMs);
    }
  })();
}

function noop() {}
async function noopAsync() {}

/**
 * Login product demo — OpenAI/Anthropic-style capability reel:
 * agentic research + tools + file deliverable, then docs/files.
 * Isolated from real PromptInput so main-app typing is never affected.
 */
export function LoginDemoPlayer() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const promptHostRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef({ x: 90, y: 160 });
  const messagesRef = useRef<Message[]>([]);

  const [scene, setScene] = useState<Scene>("label-agent");
  const [frameTall, setFrameTall] = useState(false);
  const [slideOut, setSlideOut] = useState(false);
  const [slideIn, setSlideIn] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<DemoAttachment[]>([]);
  const [dropHighlight, setDropHighlight] = useState(false);

  const [finderOpen, setFinderOpen] = useState(false);
  const [finderSelected, setFinderSelected] = useState<string[]>([]);
  const [finderDragging, setFinderDragging] = useState<string[]>([]);
  const [finderPos, setFinderPos] = useState({ left: 0, top: 0 });
  const [dragGhost, setDragGhost] = useState<{
    visible: boolean;
    x: number;
    y: number;
    files: DemoAttachment[];
  }>({ visible: false, x: 0, y: 0, files: [] });

  const [cursor, setCursor] = useState({
    x: 90,
    y: 160,
    clicking: false,
    visible: false,
  });

  const isConversationStarted = messages.length > 0;
  const hasPromptDraft = draft.trim().length > 0;
  const showChat = scene === "chat-agent" || scene === "chat-files";
  const labelText =
    scene === "label-files"
      ? DEMO_SCENES.files.label
      : DEMO_SCENES.agent.label;

  const resolveViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
  }, []);

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
    syncDemoStickyPins(viewport);
    requestAnimationFrame(() => syncDemoStickyPins(viewport));
  }, [resolveViewport]);

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

  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    easeDemoToBottom(560);
  }, [lastMessageKey, messages, easeDemoToBottom]);

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

  useEffect(() => {
    const viewport = resolveViewport();
    if (!viewport) return;

    let raf = 0;
    const run = () => {
      syncDemoStickyPins(viewport);
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
  }, [resolveViewport, isConversationStarted, lastMessageKey, showChat]);

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

    const resetChat = () => {
      messagesRef.current = [];
      setMessages([]);
      setIsGenerating(false);
      setDraft("");
      setActiveChip(null);
      setAddMenuOpen(false);
      setAttachments([]);
      setDropHighlight(false);
      setFinderOpen(false);
      setFinderSelected([]);
      setFinderDragging([]);
      setFinderPos({ left: 0, top: 0 });
      setDragGhost({ visible: false, x: 0, y: 0, files: [] });
      setCursorPos({ x: 90, y: 160, clicking: false, visible: false });
      const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) viewport.scrollTop = 0;
    };

    /** Slide current card left out, swap scene, slide new card in. */
    const transitionTo = async (
      next: Scene,
      opts?: { tall?: boolean },
    ) => {
      setSlideOut(true);
      setSlideIn(false);
      await wait(SLIDE_MS);
      if (cancelled) return;

      resetChat();
      setScene(next);
      if (opts?.tall != null) setFrameTall(opts.tall);
      setSlideOut(false);
      await wait(40);
      if (cancelled) return;
      setSlideIn(true);
      await wait(SLIDE_MS);
    };

    const growFrame = async () => {
      setFrameTall(true);
      await wait(GROW_MS);
    };

    const clickComposerAndType = async (text: string) => {
      const stage = stageRef.current;
      const root = promptRoot();
      const shell = findPromptShell(root);
      const textarea = findPromptTextarea(root);
      await moveCursor(pointInStage(stage, shell ?? textarea, 0.38, 0.48));
      if (cancelled) return;
      await clickAt();
      if (cancelled) return;
      setActiveChip(null);
      await typeDraft(text);
    };

    const sendDraft = async () => {
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
    };

    const patchAssistant = (next: Message) => {
      const prev = messagesRef.current;
      const head = prev.slice(0, -1);
      const merged = [...head, next];
      messagesRef.current = merged;
      setMessages(merged);
    };

    /** Full agentic product demo: thinking → search → fetch → create_file → answer. */
    const playAgentTurn = async () => {
      const turn = DEMO_AGENT_TURN;
      await clickComposerAndType(turn.prompt);
      if (cancelled) return;
      await wait(280);
      if (cancelled) return;
      await sendDraft();
      if (cancelled) return;

      const userMsg = buildUserMessage(turn, 0);
      const assistantCreatedAt = Date.now();
      messagesRef.current = [...messagesRef.current, userMsg];
      setMessages(messagesRef.current);
      setDraft("");
      easeDemoToBottom(560);

      await wait(380);
      if (cancelled) return;

      let assistant = buildStreamingAgentAssistant(turn, 0, assistantCreatedAt);
      messagesRef.current = [...messagesRef.current, assistant];
      setMessages(messagesRef.current);
      setIsGenerating(true);
      stickDemoToBottom();

      for (const beat of DEMO_AGENT_KEYFRAMES) {
        if (cancelled) return;
        await wait(beat.waitMs);
        if (cancelled) return;

        if (beat.frame.kind === "thinking_stream") {
          const full = beat.frame.text;
          await streamThinkingText(
            full,
            (slice) => {
              assistant = applyAgentDemoKeyframe(
                assistant,
                { kind: "thinking_stream", text: slice },
                assistantCreatedAt,
              );
              patchAssistant(assistant);
            },
            wait,
            signal,
          );
          continue;
        }

        if (beat.frame.kind === "tool_args" && beat.frame.fileContent) {
          // Reveal file contents in chunks so create_file looks live.
          const full = beat.frame.fileContent;
          let i = 0;
          while (i < full.length) {
            if (cancelled) return;
            const { size, delayMs } = naturalStreamStep(full.length - i);
            i = Math.min(full.length, i + Math.max(size * 3, 12));
            const slice = full.slice(0, i);
            assistant = applyAgentDemoKeyframe(
              assistant,
              {
                kind: "tool_args",
                toolCallId: beat.frame.toolCallId,
                args: { ...beat.frame.args, content: slice },
                fileContent: slice,
              },
              assistantCreatedAt,
            );
            patchAssistant(assistant);
            await wait(delayMs);
          }
          continue;
        }

        if (beat.frame.kind === "answer_stream") {
          const full = beat.frame.text;
          let i = 0;
          while (i < full.length) {
            if (cancelled) return;
            const { size, delayMs } = naturalStreamStep(full.length - i);
            i = Math.min(full.length, i + size);
            assistant = applyAgentDemoKeyframe(
              assistant,
              { kind: "answer_stream", text: full.slice(0, i) },
              assistantCreatedAt,
            );
            patchAssistant(assistant);
            await wait(delayMs);
          }
          continue;
        }

        assistant = applyAgentDemoKeyframe(
          assistant,
          beat.frame,
          assistantCreatedAt,
        );
        patchAssistant(assistant);

        if (beat.frame.kind === "complete") {
          setIsGenerating(false);
          requestAnimationFrame(() => stickDemoToBottom());
        }
      }
    };

    const playFilesScene = async () => {
      const stage = stageRef.current;
      const root = promptRoot();

      const addBtn = root?.querySelector(
        "[data-demo-add]",
      ) as HTMLElement | null;
      await moveCursor(pointInStage(stage, addBtn, 0.5, 0.5));
      if (cancelled) return;
      await clickAt();
      if (cancelled) return;
      setAddMenuOpen(true);
      await wait(480);
      if (cancelled) return;

      const filesItem = root?.querySelector(
        '[data-demo-add-item="files"]',
      ) as HTMLElement | null;
      await moveCursor(pointInStage(stage, filesItem, 0.45, 0.5), 900);
      if (cancelled) return;
      await clickAt();
      if (cancelled) return;
      setAddMenuOpen(false);

      const stageEl = stageRef.current;
      const frameEl = frameRef.current;
      if (stageEl && frameEl) {
        const s = stageEl.getBoundingClientRect();
        const f = frameEl.getBoundingClientRect();
        setFinderPos({
          left: Math.min(
            s.width - 292,
            Math.max(8, f.right - s.left - 120),
          ),
          top: Math.max(12, f.top - s.top + f.height * 0.22),
        });
      }
      setFinderOpen(true);
      await wait(520);
      if (cancelled) return;

      const pickIds = [...DEMO_DRAG_FILE_IDS];
      const selected: string[] = [];
      for (const id of pickIds) {
        if (cancelled) return;
        const el = stageRef.current?.querySelector(
          `[data-demo-finder-file="${id}"]`,
        ) as HTMLElement | null;
        await moveCursor(pointInStage(stage, el, 0.5, 0.4), 850);
        if (cancelled) return;
        await clickAt();
        if (cancelled) return;
        selected.push(id);
        setFinderSelected([...selected]);
        await wait(220);
      }

      const dragFiles = DEMO_FINDER_FILES.filter((f) =>
        selected.includes(f.id),
      );
      setFinderDragging(selected);
      const shell = findPromptShell(root);
      const from = { ...cursorPosRef.current };
      const to = pointInStage(stage, shell, 0.5, 0.35);

      setDragGhost({
        visible: true,
        x: from.x,
        y: from.y,
        files: dragFiles,
      });

      await animate(1100, (t) => {
        const e = easeInOutCubic(t);
        const x = from.x + (to.x - from.x) * e;
        const y = from.y + (to.y - from.y) * e;
        setCursorPos({ x, y, visible: true, clicking: false });
        setDragGhost({ visible: true, x, y, files: dragFiles });
        if (t > 0.72) setDropHighlight(true);
      });
      if (cancelled) return;

      await wait(120);
      if (cancelled) return;

      setDragGhost({ visible: false, x: to.x, y: to.y, files: [] });
      setFinderDragging([]);
      setAttachments(dragFiles);
      setDropHighlight(false);
      setFinderOpen(false);
      setFinderSelected([]);
      setCursor((c) => ({ ...c, visible: false }));

      await wait(700);
      if (cancelled) return;

      const turn = DEMO_FILES_TURN;
      await clickComposerAndType(turn.prompt);
      if (cancelled) return;
      await wait(280);
      if (cancelled) return;
      await sendDraft();
      if (cancelled) return;

      const userMsg = {
        ...buildUserMessage(turn, 0),
        attachments: dragFiles.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType:
            f.kind === "image"
              ? "image/jpeg"
              : f.kind === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          kind:
            f.kind === "image"
              ? ("image" as const)
              : ("document" as const),
          previewUrl: f.previewUrl,
        })),
      };
      const assistantCreatedAt = Date.now();
      messagesRef.current = [...messagesRef.current, userMsg];
      setMessages(messagesRef.current);
      setDraft("");
      setAttachments([]);
      easeDemoToBottom(560);

      await wait(400);
      if (cancelled) return;

      const placeholder = buildAssistantMessage(
        turn,
        0,
        "",
        true,
        assistantCreatedAt,
      );
      messagesRef.current = [...messagesRef.current, placeholder];
      setMessages(messagesRef.current);
      setIsGenerating(true);
      stickDemoToBottom();

      await wait(220);
      if (cancelled) return;

      let cursorIdx = 0;
      while (cursorIdx < turn.reply.length) {
        if (cancelled) return;
        const { size, delayMs } = naturalStreamStep(
          turn.reply.length - cursorIdx,
        );
        cursorIdx = Math.min(turn.reply.length, cursorIdx + size);
        const slice = turn.reply.slice(0, cursorIdx);
        patchAssistant(
          buildAssistantMessage(turn, 0, slice, true, assistantCreatedAt),
        );
        await wait(delayMs);
      }

      patchAssistant(
        buildAssistantMessage(turn, 0, turn.reply, false, assistantCreatedAt),
      );
      setIsGenerating(false);
      requestAnimationFrame(() => stickDemoToBottom());
    };

    const run = async () => {
      while (!cancelled) {
        // 1) Agentic chapter title
        resetChat();
        setScene("label-agent");
        setFrameTall(false);
        setSlideOut(false);
        setSlideIn(true);
        await wait(IDLE_MS);
        if (cancelled) return;
        await wait(LABEL_HOLD_MS);
        if (cancelled) return;

        // 2) Agent product demo (search → tools → file)
        await transitionTo("chat-agent", { tall: false });
        if (cancelled) return;
        await growFrame();
        if (cancelled) return;
        await wait(420);
        if (cancelled) return;
        await playAgentTurn();
        if (cancelled) return;
        await wait(HOLD_AFTER_AGENT_MS);
        if (cancelled) return;

        // 3) Files chapter title
        await transitionTo("label-files", { tall: false });
        if (cancelled) return;
        await wait(LABEL_HOLD_MS);
        if (cancelled) return;

        // 4) Drop docs + prioritize reply
        await transitionTo("chat-files", { tall: false });
        if (cancelled) return;
        await growFrame();
        if (cancelled) return;
        await wait(500);
        if (cancelled) return;
        await playFilesScene();
        if (cancelled) return;
        await wait(HOLD_AFTER_FILES_MS);
        if (cancelled) return;
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
        addMenuOpen={addMenuOpen}
        attachments={attachments}
        dropHighlight={dropHighlight}
      />
    </div>
  );

  const frameClass = frameTall
    ? "h-[min(72%,560px)] w-[min(88%,460px)]"
    : "h-[min(58%,480px)] w-[min(82%,440px)]";

  return (
    <div
      ref={stageRef}
      className="login-demo-stage relative flex h-full min-h-0 w-full items-center justify-center"
      aria-hidden
    >
      <div
        ref={frameRef}
        data-demo-frame
        className={`login-demo-stage-frame relative flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-black/10 bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45),0_0_0_1px_rgba(255,255,255,0.35)_inset] transition-[height,width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${frameClass} ${
          slideOut
            ? "login-demo-slide-out"
            : slideIn
              ? "login-demo-slide-in"
              : "opacity-0 translate-x-8"
        }`}
      >
        {showChat ? (
          <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
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
                hasPromptDraft={hasPromptDraft || attachments.length > 0}
                isAddMenuOpen={addMenuOpen}
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
        ) : (
          <DemoSceneLabel label={labelText} />
        )}
      </div>

      {finderOpen ? (
        <div
          className="pointer-events-none absolute z-30 animate-in fade-in zoom-in-95 duration-300"
          style={{ left: finderPos.left, top: finderPos.top }}
        >
          <DemoFinder
            files={DEMO_FINDER_FILES}
            selectedIds={finderSelected}
            draggingIds={finderDragging}
          />
        </div>
      ) : null}

      <DemoDragGhost
        files={dragGhost.files}
        x={dragGhost.x}
        y={dragGhost.y}
        visible={dragGhost.visible}
      />

      <MacCursor
        x={cursor.x}
        y={cursor.y}
        clicking={cursor.clicking}
        visible={cursor.visible}
      />
    </div>
  );
}
