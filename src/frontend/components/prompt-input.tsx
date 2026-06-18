"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  LayoutPanelTop,
  LoaderCircle,
  Mic,
  Plus,
  Square,
  Telescope,
  X,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  captureDisplayScreenshot,
  ScreenshotCaptureError,
} from "@/frontend/lib/capture-display-screenshot";
import { PromptAddMenu, type PromptComposeAction } from "./prompt-add-menu";
import { PromptModelSelector } from "./prompt-model-selector";
import { HintTooltip } from "./ui/hint-tooltip";
import { useIsClient } from "@/frontend/hooks/use-is-client";
import type { ChatModelId } from "@/lib/chat-models";

interface PromptInputProps {
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  onScrollToBottom?: () => void;
  showScrollToBottomButton?: boolean;
  isConversationStarted: boolean;
  isGenerating: boolean;
  /** Fires on every draft change so parent layouts can react without lifting full state. */
  onPromptChange?: (value: string) => void;
  /** When this value changes (e.g. new chat), the textarea is focused again. */
  focusKey?: string;
  onUpgradeClick?: () => void;
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  webSearchEnabled?: boolean;
  onWebSearchEnabledChange?: (enabled: boolean) => void;
  /** Hide model selector in the toolbar (e.g. when shown in the welcome header). */
  showModelSelector?: boolean;
  chatModel?: ChatModelId;
  onChatModelChange?: (model: ChatModelId) => void;
}

const COMPOSE_ACTION_META: Record<
  PromptComposeAction,
  {
    label: string;
    placeholder: string;
    icon: typeof Telescope;
  }
> = {
  "deep-research": {
    label: "Deep research",
    placeholder: "What do you want to research?",
    icon: Telescope,
  },
  canvas: {
    label: "Canvas",
    placeholder: "Describe what to create on canvas",
    icon: LayoutPanelTop,
  },
};

type PromptAttachment = {
  id: string;
  name: string;
  previewUrl: string;
  mimeType: string;
};

const addMenuTriggerClass =
  "menu-trigger-active flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

const WAVE_DOT_COUNT = 36;
/** Fallback single-line height when measurement is not ready yet. */
const COLLAPSED_TEXTAREA_HEIGHT_PX = 20;
const MAX_PROMPT_LINES = 7;
const PROMPT_NOTIFY_DEBOUNCE_MS = 120;

export function PromptInput({
  onSendMessage,
  onStopGeneration,
  onScrollToBottom,
  showScrollToBottomButton = false,
  isConversationStarted,
  isGenerating,
  onPromptChange,
  focusKey,
  onUpgradeClick,
  thinkingEnabled = false,
  onThinkingEnabledChange,
  webSearchEnabled = false,
  onWebSearchEnabledChange,
  showModelSelector = true,
  chatModel = "helios",
  onChatModelChange,
}: PromptInputProps) {
  /** Uncontrolled input — draft lives in the DOM ref, not React state (zero parent re-renders). */
  const [hasDraft, setHasDraft] = useState(false);
  const draftNotifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedQuickActions, setSelectedQuickActions] = useState<
    Array<"video" | "music">
  >([]);
  const [activeComposeAction, setActiveComposeAction] =
    useState<PromptComposeAction | null>(null);
  const [composeChipHovered, setComposeChipHovered] = useState(false);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [waveLevels, setWaveLevels] = useState<number[]>(() =>
    Array.from({ length: WAVE_DOT_COUNT }, () => 0.12),
  );
  const [isMultiline, setIsMultiline] = useState(false);
  const singleLineHeightRef = useRef(COLLAPSED_TEXTAREA_HEIGHT_PX);
  const promptShellRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldSubmitRecordingRef = useRef(false);
  const showComposeControls =
    activeComposeAction != null && !isConversationStarted;
  const composeMeta = activeComposeAction
    ? COMPOSE_ACTION_META[activeComposeAction]
    : null;
  const showDictationSurface = isDictating || isTranscribing;
  const isClient = useIsClient();

  const readDraft = useCallback(() => textareaRef.current?.value ?? "", []);

  const scheduleDraftNotify = useCallback(() => {
    const value = readDraft();
    const has = value.trim().length > 0;
    setHasDraft(has);

    if (draftNotifyTimeoutRef.current) {
      clearTimeout(draftNotifyTimeoutRef.current);
    }
    draftNotifyTimeoutRef.current = setTimeout(() => {
      onPromptChange?.(readDraft());
      draftNotifyTimeoutRef.current = null;
    }, PROMPT_NOTIFY_DEBOUNCE_MS);
  }, [onPromptChange, readDraft]);

  const syncDraftImmediate = useCallback(
    (value: string) => {
      if (textareaRef.current) textareaRef.current.value = value;
      const has = value.trim().length > 0;
      setHasDraft(has);
      if (draftNotifyTimeoutRef.current) {
        clearTimeout(draftNotifyTimeoutRef.current);
        draftNotifyTimeoutRef.current = null;
      }
      onPromptChange?.(value);
    },
    [onPromptChange],
  );

  useEffect(() => {
    if (isConversationStarted) {
      setActiveComposeAction(null);
    }
  }, [isConversationStarted]);

  const getSingleLineHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return singleLineHeightRef.current;

    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const measured = Math.ceil(
      (Number.isFinite(lineHeight) ? lineHeight : 20) +
        paddingTop +
        paddingBottom +
        borderTop +
        borderBottom,
    );
    singleLineHeightRef.current = Math.max(
      COLLAPSED_TEXTAREA_HEIGHT_PX,
      measured,
    );
    return singleLineHeightRef.current;
  }, []);

  const getTextareaMaxHeight = useCallback(() => {
    return getSingleLineHeight() * MAX_PROMPT_LINES;
  }, [getSingleLineHeight]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || showDictationSurface) return;

    const singleLineHeight = getSingleLineHeight();
    const maxHeight = getTextareaMaxHeight();
    const draft = readDraft();
    const hasExplicitNewline = draft.includes("\n");

    textarea.style.height = "0px";
    const scrollHeight = textarea.scrollHeight;
    const needsExpandedLayout =
      hasExplicitNewline ||
      scrollHeight > singleLineHeight + 2 ||
      (draft.length > 0 && textarea.scrollWidth > textarea.clientWidth + 1);

    setIsMultiline((prev) =>
      prev === needsExpandedLayout ? prev : needsExpandedLayout,
    );

    const nextHeight = Math.min(
      Math.max(scrollHeight, singleLineHeight),
      maxHeight,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [getTextareaMaxHeight, getSingleLineHeight, readDraft, showDictationSurface]);

  useEffect(() => {
    resizeTextarea();
  }, [
    isConversationStarted,
    showDictationSurface,
    showComposeControls,
    resizeTextarea,
  ]);

  useEffect(() => {
    const shell = promptShellRef.current;
    if (!shell) return;

    const observer = new ResizeObserver(() => {
      getSingleLineHeight();
      resizeTextarea();
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [getSingleLineHeight, resizeTextarea]);

  useEffect(() => {
    syncDraftImmediate("");
    setIsMultiline(false);
    singleLineHeightRef.current = COLLAPSED_TEXTAREA_HEIGHT_PX;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const t = window.setTimeout(() => {
      textarea.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [focusKey, syncDraftImmediate]);

  useEffect(() => {
    return () => {
      if (draftNotifyTimeoutRef.current) {
        clearTimeout(draftNotifyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Tab" || e.key === "Escape") return;

      if (document.activeElement?.closest("[data-skip-global-prompt-focus]")) {
        return;
      }

      const target = e.target as Node | null;
      if (target instanceof HTMLElement) {
        if (
          target.closest("[data-skip-global-prompt-focus]") ||
          target.closest('[role="dialog"]') ||
          target.closest("[data-radix-popper-content-wrapper]") ||
          target.closest("[data-radix-portal]")
        ) {
          return;
        }
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const isPrintable =
        (e.key.length === 1 && e.key !== "\r" && e.key !== "\n") ||
        e.key === " ";

      if (!isPrintable) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      e.preventDefault();
      textarea.focus({ preventScroll: true });
      const ch = e.key === " " ? " " : e.key;
      const next = `${textarea.value}${ch}`;
      syncDraftImmediate(next);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const dismissComposerFocus = useCallback(() => {
    textareaRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }, []);

  const handleSubmit = () => {
    const value = readDraft().trim();
    if ((value || attachments.length > 0) && !isGenerating) {
      onSendMessage(value);
      syncDraftImmediate("");
      setIsMultiline(false);
      setAttachments([]);
      setAttachmentError(null);
      requestAnimationFrame(() => {
        resizeTextarea();
        dismissComposerFocus();
      });
    }
  };

  const addAttachment = useCallback((attachment: PromptAttachment) => {
    setAttachments((prev) => [...prev, attachment]);
    setAttachmentError(null);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Could not read file."));
          reader.readAsDataURL(file);
        });

        addAttachment({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          previewUrl: dataUrl,
          mimeType: file.type,
        });
      }
    },
    [addAttachment],
  );

  const handleTakeScreenshot = useCallback(async () => {
    if (isCapturingScreenshot) return;
    setAttachmentError(null);
    setIsCapturingScreenshot(true);
    try {
      const shot = await captureDisplayScreenshot();
      addAttachment({
        id: `screenshot-${Date.now()}`,
        name: shot.fileName,
        previewUrl: shot.dataUrl,
        mimeType: "image/png",
      });
    } catch (error) {
      if (
        error instanceof ScreenshotCaptureError &&
        (error.code === "cancelled" || error.code === "denied")
      ) {
        return;
      }
      setAttachmentError(
        error instanceof ScreenshotCaptureError
          ? error.message
          : "Could not capture screenshot.",
      );
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [addAttachment, isCapturingScreenshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "u") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      openFilePicker();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openFilePicker]);

  const handleInput = useCallback(() => {
    scheduleDraftNotify();
    resizeTextarea();
  }, [resizeTextarea, scheduleDraftNotify]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      handleSubmit();
    }
  };

  const quickActionLabelMap: Record<"video" | "music", string> = {
    video: "Video",
    music: "Music",
  };

  const handleQuickActionSelect = (action: "video" | "music") => {
    setSelectedQuickActions((prev) =>
      prev.includes(action) ? prev : [...prev, action],
    );
  };

  const handleQuickActionRemove = (action: "video" | "music") => {
    setSelectedQuickActions((prev) => prev.filter((item) => item !== action));
  };

  const handleComposeActionSelect = (action: PromptComposeAction) => {
    if (isConversationStarted) return;
    setActiveComposeAction(action);
  };

  const handleComposeActionRemove = () => {
    setActiveComposeAction(null);
    resizeTextarea();
  };

  const releaseRecordingResources = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      releaseRecordingResources();
    };
  }, [releaseRecordingResources]);

  useEffect(() => {
    if (!isDictating) {
      setWaveLevels(Array.from({ length: WAVE_DOT_COUNT }, () => 0.12));
      return;
    }

    let frameId = 0;
    const tick = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        const bins = Math.min(24, data.length);
        for (let index = 0; index < bins; index += 1) {
          sum += data[index] ?? 0;
        }
        const level = Math.min(1, (sum / (bins * 255)) * 3.2);
        setWaveLevels((prev) => [...prev.slice(1), Math.max(0.12, level)]);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isDictating]);

  const cancelDictation = useCallback(() => {
    shouldSubmitRecordingRef.current = false;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      releaseRecordingResources();
    }
    setIsDictating(false);
  }, [releaseRecordingResources]);

  const submitDictation = useCallback(() => {
    shouldSubmitRecordingRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const startDictation = useCallback(async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      return;
    }

    if (isDictating) {
      cancelDictation();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      shouldSubmitRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const shouldSubmit = shouldSubmitRecordingRef.current;
        recorderRef.current = null;
        releaseRecordingResources();
        setIsDictating(false);
        if (!shouldSubmit || audio.size === 0) return;

        setIsTranscribing(true);
        try {
          const body = new FormData();
          body.append("audio", audio, "dictation.webm");
          const response = await fetch("/api/v1/audio/transcriptions", {
            method: "POST",
            body,
          });
          if (!response.ok) return;
          const result = (await response.json()) as {
            text?: string;
            transcript?: string;
          };
          const transcript = (result.text ?? result.transcript ?? "").trim();
          if (transcript) {
            const previous = readDraft();
            const next =
              previous && !/\s$/.test(previous)
                ? `${previous} ${transcript}`
                : previous + transcript;
            syncDraftImmediate(next);
          }
        } catch {
          // The transcription endpoint is supplied by the server integration.
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start(100);
      setIsDictating(true);
    } catch {
      setIsDictating(false);
      releaseRecordingResources();
    }
  }, [cancelDictation, isDictating, releaseRecordingResources]);

  const micButtonClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

  const promptShellClass = cn(
    "w-full max-w-full transition-[min-height,box-shadow,border-color,background-color] duration-200 ease-out",
    showComposeControls &&
      "min-h-[92px] border-zinc-200/80 bg-white/92 shadow-[0_8px_24px_-10px_rgba(24,24,27,0.12)] backdrop-blur-md",
  );

  const renderMicButton = () => (
    <HintTooltip content="Dictate">
      <button
        type="button"
        onClick={startDictation}
        aria-pressed={isDictating}
        className={micButtonClass}
        data-app-button
      >
        <Mic className="icon-lg shrink-0 opacity-80 sm:icon-xl" />
      </button>
    </HintTooltip>
  );

  const renderDisabledSendButton = () => (
    <HintTooltip content="Send">
      <button
        type="button"
        disabled
        aria-label="Send"
        className="no-hover-overlay flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-zinc-900 text-white opacity-40"
      >
        <ArrowUp className="icon-lg" />
      </button>
    </HintTooltip>
  );

  const renderTrailingActions = () => {
    if (showDictationSurface) {
      return (
        <>
          <HintTooltip content="Cancel dictation">
            <button
              type="button"
              onClick={cancelDictation}
              disabled={isTranscribing}
              aria-label="Cancel dictation"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100",
                isTranscribing && "cursor-not-allowed opacity-40",
              )}
            >
              <X className="icon-lg" />
            </button>
          </HintTooltip>
          <HintTooltip content="Submit dictation">
            <button
              type="button"
              onClick={submitDictation}
              disabled={isTranscribing}
              aria-label="Submit dictation"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                isTranscribing
                  ? "cursor-wait bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {isTranscribing ? (
                <LoaderCircle className="icon-md animate-spin" />
              ) : (
                <Check className="icon-lg" />
              )}
            </button>
          </HintTooltip>
        </>
      );
    }

    return (
      <>
        {renderMicButton()}
        {isGenerating ? (
          <HintTooltip content="Stop generating">
            <button
              type="button"
              onClick={onStopGeneration}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white transition-all duration-200 hover:bg-zinc-900 data-app-button"
              data-app-button
            >
              <Square className="icon-md fill-current" />
            </button>
          </HintTooltip>
        ) : hasDraft || attachments.length > 0 ? (
          <HintTooltip content="Send">
            <button
              type="button"
              onClick={handleSubmit}
              className="no-hover-overlay flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition-all duration-200 hover:bg-zinc-800 data-app-button"
              data-app-button
            >
              <ArrowUp className="icon-lg" />
            </button>
          </HintTooltip>
        ) : (
          renderDisabledSendButton()
        )}
      </>
    );
  };

  const renderAddMenuButton = () => (
    <PromptAddMenu
      onQuickActionSelect={handleQuickActionSelect}
      onComposeActionSelect={handleComposeActionSelect}
      onThinkingToggle={() => onThinkingEnabledChange?.(!thinkingEnabled)}
      thinkingEnabled={thinkingEnabled}
      showThinkingToggle={Boolean(onThinkingEnabledChange)}
      onWebSearchToggle={() => onWebSearchEnabledChange?.(!webSearchEnabled)}
      webSearchEnabled={webSearchEnabled}
      onAddFiles={openFilePicker}
      onTakeScreenshot={() => void handleTakeScreenshot()}
      showComposeActions={!isConversationStarted}
      trigger={
        <button
          type="button"
          aria-label="Add content"
          disabled={isCapturingScreenshot}
          className={cn(
            addMenuTriggerClass,
            isCapturingScreenshot && "opacity-50",
          )}
        >
          <Plus
            className="icon-lg shrink-0 opacity-80 sm:icon-xl"
            strokeWidth={1.75}
          />
        </button>
      }
    />
  );

  const renderModelSelector = () =>
    showModelSelector ? (
      <PromptModelSelector
        compact
        selectedModel={chatModel}
        onSelectedModelChange={(model) => onChatModelChange?.(model)}
        onUpgradeClick={onUpgradeClick}
        thinkingEnabled={thinkingEnabled}
        onThinkingEnabledChange={(enabled) =>
          onThinkingEnabledChange?.(enabled)
        }
      />
    ) : null;

  const renderPromptToolbar = (centerSlot?: ReactNode) => (
    <div className="flex items-center gap-1 px-1.5 py-1.5 sm:gap-1.5 sm:px-2 sm:py-1.5">
      {renderAddMenuButton()}
      {centerSlot}
      <div className="min-w-0 flex-1" />
      {renderModelSelector()}
      <div className="flex shrink-0 items-center gap-1">
        {renderTrailingActions()}
      </div>
    </div>
  );


  const renderPromptBody = (
    placeholder: string,
    centerSlot?: ReactNode,
    forceExpanded = false,
  ) => {
    const expanded =
      forceExpanded || isMultiline || showDictationSurface || showComposeControls;

    return (
      <div
        className={cn(
          "flex w-full",
          expanded
            ? "flex-col"
            : "items-center gap-1 px-1.5 py-1 sm:gap-1.5 sm:px-2 sm:py-1",
        )}
      >
        {!expanded && renderAddMenuButton()}
        <div
          className={cn(
            "min-w-0 flex-1",
            expanded && "w-full px-2 pt-1.5 pb-0 sm:px-2.5",
          )}
        >
          {renderTextareaField(placeholder)}
        </div>
        {!expanded && (
          <>
            {centerSlot}
            {renderModelSelector()}
            <div className="flex shrink-0 items-center gap-1">
              {renderTrailingActions()}
            </div>
          </>
        )}
        {expanded && renderPromptToolbar(centerSlot)}
      </div>
    );
  };

  const renderTextareaField = (placeholder: string, className?: string) =>
    showDictationSurface ? (
      <div className="flex h-9 min-w-0 items-center overflow-hidden">
        {isTranscribing ? (
          <div className="flex w-full items-center gap-2 text-[13px] text-zinc-500">
            <LoaderCircle className="icon-md animate-spin" />
            <span>Transcribing...</span>
          </div>
        ) : (
          <div
            className="flex h-9 w-full items-center justify-end gap-[3px] overflow-hidden px-0.5"
            aria-label="Voice recording waveform"
          >
            {waveLevels.map((level, index) => (
              <span
                key={index}
                className="w-[3px] shrink-0 rounded-full bg-zinc-400/90 transition-[height] duration-75 ease-out"
                style={{ height: `${6 + level * 22}px` }}
              />
            ))}
          </div>
        )}
      </div>
    ) : (
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        defaultValue=""
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "block w-full resize-none border-0 bg-transparent text-[14px] font-[430] leading-[20px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-[14px] sm:leading-[21px]",
          showComposeControls
            ? "min-h-[44px] px-1 py-1.5"
            : isMultiline
              ? "min-h-[20px] px-0 py-1"
              : "min-h-[20px] px-0 py-0.5",
          className,
        )}
        rows={1}
      />
    );

  if (!isClient) {
    return (
      <div
        className={cn(
          "flex w-full flex-col",
          isConversationStarted ? "items-stretch" : "items-center",
        )}
        data-prompt-root
        suppressHydrationWarning
      >
        <div
          className={cn(
            "relative flex w-full",
            !isConversationStarted && "justify-center",
          )}
          data-prompt-wrapper
        >
          <div className={promptShellClass} data-prompt-shell>
            <div className="flex items-center gap-1 px-1.5 py-1 sm:gap-1.5 sm:px-2 sm:py-1">
              <button
                type="button"
                aria-label="Add content"
                className={addMenuTriggerClass}
                tabIndex={-1}
              >
                <Plus
                  className="icon-lg shrink-0 opacity-80 sm:icon-xl"
                  strokeWidth={1.75}
                />
              </button>
              <div className="min-w-0 flex-1">
                <textarea
                  readOnly
                  tabIndex={-1}
                  aria-hidden
                  placeholder="Ask anything"
                  rows={1}
                  className="block min-h-[20px] w-full resize-none border-0 bg-transparent py-0.5 text-[14px] font-[430] leading-[20px] text-zinc-800 shadow-none outline-none placeholder:text-zinc-400"
                />
              </div>
              <button
                type="button"
                className={micButtonClass}
                tabIndex={-1}
                aria-hidden
              >
                <Mic className="icon-lg shrink-0 opacity-80 sm:icon-xl" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex w-full flex-col",
          isConversationStarted ? "items-stretch" : "items-center",
        )}
        data-prompt-root
        data-streaming={isGenerating || undefined}
      >
        <div
          className={cn(
            "relative flex w-full",
            !isConversationStarted && "justify-center",
          )}
          data-prompt-wrapper
        >
          {showScrollToBottomButton && onScrollToBottom && (
            <HintTooltip content="Scroll to latest">
              <button
                type="button"
                onClick={onScrollToBottom}
                className="absolute -top-11 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-500 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white hover:text-zinc-700"
              >
                <ArrowDown className="icon-md" />
              </button>
            </HintTooltip>
          )}

          <div
            className={promptShellClass}
            ref={promptShellRef}
            data-prompt-shell
            data-compose-mode={showComposeControls || undefined}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {selectedQuickActions.length > 0 ? (
                <motion.div
                  key="other-compose-controls"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 overflow-hidden px-3 pt-2 pb-0"
                >
                  {selectedQuickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => handleQuickActionRemove(action)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-2.5 text-[12px] text-zinc-600 transition-colors hover:bg-zinc-50"
                      >
                        <span>{quickActionLabelMap[action]}</span>
                        <X className="icon-sm" />
                      </button>
                    ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false} mode="popLayout">
              {attachments.length > 0 ? (
                <motion.div
                  key="prompt-attachments"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-1.5 overflow-hidden px-2 pt-2 sm:px-2.5"
                >
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="group relative h-12 w-12 overflow-hidden rounded-lg border border-zinc-200/90 bg-zinc-50"
                    >
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${attachment.name}`}
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {attachmentError ? (
              <p className="px-2.5 pt-1 text-[11px] text-red-600 sm:px-3">
                {attachmentError}
              </p>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void handleFileInputChange(event)}
            />

            {showComposeControls && composeMeta ? (
              renderPromptBody(
                composeMeta.placeholder,
                <button
                  type="button"
                  aria-label={`Close ${composeMeta.label} mode`}
                  onMouseEnter={() => setComposeChipHovered(true)}
                  onMouseLeave={() => setComposeChipHovered(false)}
                  onClick={handleComposeActionRemove}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#2c84db]/15 bg-[#e9f3ff] px-2.5 text-[12px] font-medium text-[#2c84db] transition-colors hover:bg-[#ddebff]"
                >
                  {composeChipHovered ? (
                    <X className="icon-lg" />
                  ) : (
                    <composeMeta.icon className="icon-lg" />
                  )}
                  <span>{composeMeta.label}</span>
                </button>,
                true,
              )
            ) : (
              renderPromptBody("Ask anything")
            )}
          </div>
        </div>
      </div>
      {isConversationStarted ? (
        <div
          data-context-footer
          className="agent-panel-followup-status-area mt-1.5 w-full"
        >
          <div className="glass-chat-status-bar">
            <p className="glass-chat-status-bar__center">
              Clauxen can make mistakes. Check important info.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
