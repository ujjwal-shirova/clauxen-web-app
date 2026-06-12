"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
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
import { VoiceCall } from "./voice-call";
import { PromptAddMenu, type PromptComposeAction } from "./prompt-add-menu";
import { HintTooltip } from "./ui/hint-tooltip";
import { useIsClient } from "@/frontend/hooks/use-is-client";

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
  "menu-trigger-active mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 data-[state=open]:bg-zinc-50 data-[state=open]:text-zinc-700";

export function PromptInput({
  onSendMessage,
  onStopGeneration,
  onScrollToBottom,
  showScrollToBottomButton = false,
  isConversationStarted,
  isGenerating,
  onPromptChange,
  focusKey,
  thinkingEnabled = false,
  onThinkingEnabledChange,
  webSearchEnabled = false,
  onWebSearchEnabledChange,
  showModelSelector = true,
}: PromptInputProps) {
  /** Uncontrolled input — draft lives in the DOM ref, not React state (zero parent re-renders). */
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSnapshot, setDraftSnapshot] = useState("");
  const draftNotifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
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
    if (draftNotifyTimeoutRef.current) {
      clearTimeout(draftNotifyTimeoutRef.current);
    }
    draftNotifyTimeoutRef.current = setTimeout(() => {
      const value = readDraft();
      const has = value.trim().length > 0;
      setHasDraft(has);
      setDraftSnapshot(value);
      onPromptChange?.(value);
    }, 250);
  }, [onPromptChange, readDraft]);

  const syncDraftImmediate = useCallback(
    (value: string) => {
      if (textareaRef.current) textareaRef.current.value = value;
      const has = value.trim().length > 0;
      setHasDraft(has);
      setDraftSnapshot(value);
      onPromptChange?.(value);
    },
    [onPromptChange],
  );

  useEffect(() => {
    if (isConversationStarted) {
      setActiveComposeAction(null);
    }
  }, [isConversationStarted]);

  const getTextareaMaxHeight = useCallback(() => {
    if (showComposeControls) return 200;
    if (isConversationStarted) return 200;
    return 140;
  }, [isConversationStarted, showComposeControls]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const maxHeight = getTextareaMaxHeight();
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [getTextareaMaxHeight]);

  useEffect(() => {
    resizeTextarea();
  }, [draftSnapshot, isConversationStarted, showDictationSurface, showComposeControls, resizeTextarea]);

  useEffect(() => {
    syncDraftImmediate("");
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
      setAttachments([]);
      setAttachmentError(null);
      requestAnimationFrame(() => {
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
    if (!isDictating) return;
    const canvas = waveformRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    const data = new Uint8Array(analyser.fftSize);

    const renderWaveform = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      analyser.getByteTimeDomainData(data);
      context.strokeStyle = "#a1a1aa";
      context.lineWidth = 1.5;
      context.beginPath();
      data.forEach((point, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = (point / 128) * (height / 2);
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
      frameId = window.requestAnimationFrame(renderWaveform);
    };

    renderWaveform();
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
      setVoiceCallOpen(true);
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
      setVoiceCallOpen(true);
    }
  }, [cancelDictation, isDictating, releaseRecordingResources]);

  const micButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10";

  const promptShellClass = cn(
    "w-full max-w-full transition-[min-height,box-shadow,border-color,background-color] duration-200 ease-out",
    isConversationStarted
      ? "sm:max-w-[min(768px,calc(100vw-2.5rem))]"
      : "sm:max-w-[min(720px,calc(100vw-2.5rem))]",
    showComposeControls &&
      "min-h-[108px] border-zinc-200/80 bg-white/92 shadow-[0_8px_24px_-10px_rgba(24,24,27,0.12)] backdrop-blur-md",
  );

  const renderMicButton = () => (
    <HintTooltip content="Dictate">
      <button
        type="button"
        onClick={startDictation}
        disabled={isGenerating}
        aria-pressed={isDictating}
        className={cn(micButtonClass, isGenerating && "opacity-40")}
        data-app-button
      >
        <Mic className="icon-lg shrink-0 opacity-80 sm:icon-xl" />
      </button>
    </HintTooltip>
  );

  const renderTrailingActions = (voiceModeBlue = false) => {
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
                "flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100",
                isTranscribing && "cursor-not-allowed opacity-40",
              )}
            >
              <X className="icon-xl" />
            </button>
          </HintTooltip>
          <HintTooltip content="Submit dictation">
            <button
              type="button"
              onClick={submitDictation}
              disabled={isTranscribing}
              aria-label="Submit dictation"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100",
                isTranscribing && "cursor-not-allowed opacity-40",
              )}
            >
              {isTranscribing ? (
                <LoaderCircle className="icon-xl animate-spin" />
              ) : (
                <Check className="icon-xl" />
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white transition-all duration-200 hover:bg-zinc-900 data-app-button"
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
              className="no-hover-overlay flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition-all duration-200 hover:bg-zinc-800 data-app-button"
              data-app-button
            >
              <ArrowUp className="icon-xl" />
            </button>
          </HintTooltip>
        ) : (
          <HintTooltip content="Voice Mode.">
            <button
              type="button"
              onClick={() => setVoiceCallOpen(true)}
              className={cn(
                "no-hover-overlay flex h-9 w-9 items-center justify-center rounded-full text-white transition-all duration-200",
                voiceModeBlue
                  ? "bg-[#2c84db] hover:bg-[#2574c4]"
                  : "bg-zinc-900 hover:bg-zinc-800",
              )}
            >
              <AudioLines className="icon-lg shrink-0 sm:icon-xl" />
            </button>
          </HintTooltip>
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

  const renderTextarea = (placeholder: string, className?: string) => (
    <AnimatePresence initial={false} mode="wait">
      {showDictationSurface ? (
        <motion.div
          key="dictation-waveform"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.18 }}
          className="flex h-10 min-w-0 items-center overflow-hidden"
        >
          {isTranscribing ? (
            <div className="flex w-full items-center gap-2 text-[14px] text-zinc-500">
              <LoaderCircle className="icon-md animate-spin" />
              <span>Transcribing...</span>
            </div>
          ) : (
            <canvas
              ref={waveformRef}
              height={80}
              width={1456}
              aria-label="Voice recording waveform"
              className="h-10 w-full align-middle"
            />
          )}
        </motion.div>
      ) : (
        <motion.textarea
          key="prompt-field"
          ref={textareaRef}
          placeholder={placeholder}
          defaultValue=""
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className={cn(
            "block w-full resize-none border-0 bg-transparent text-[15px] font-[430] leading-[22px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-[15px] sm:leading-[23px]",
            showComposeControls
              ? "min-h-[52px] px-1 py-2"
              : "min-h-[24px] py-2",
            className,
          )}
          rows={1}
        />
      )}
    </AnimatePresence>
  );

  if (!isClient) {
    return (
      <div
        className="flex w-full flex-col items-center"
        data-prompt-root
        suppressHydrationWarning
      >
        <div className="relative flex w-full justify-center" data-prompt-wrapper>
          <div className={promptShellClass} data-prompt-shell>
            <div className="flex items-end gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-2.5 sm:py-2">
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
                  className="block min-h-[24px] w-full resize-none border-0 bg-transparent py-2 text-[15px] font-[430] leading-[22px] text-zinc-800 shadow-none outline-none placeholder:text-zinc-400"
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
        className="flex w-full flex-col items-center"
        data-prompt-root
        data-streaming={isGenerating || undefined}
      >
        <div className="relative flex w-full justify-center" data-prompt-wrapper>
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
                  className="flex items-center gap-1.5 overflow-hidden px-4 pt-2.5 pb-0"
                >
                  {selectedQuickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => handleQuickActionRemove(action)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-2.5 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50"
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
                  className="flex flex-wrap gap-1.5 overflow-hidden px-2.5 pt-2 sm:px-3"
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
              <div className="flex flex-col">
                <div className="min-w-0 px-3 pt-3 pb-1 sm:px-4">
                  {renderTextarea(composeMeta.placeholder)}
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-2.5 sm:py-2">
                  {renderAddMenuButton()}
                  <button
                    type="button"
                    aria-label={`Close ${composeMeta.label} mode`}
                    onMouseEnter={() => setComposeChipHovered(true)}
                    onMouseLeave={() => setComposeChipHovered(false)}
                    onClick={handleComposeActionRemove}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#2c84db]/15 bg-[#e9f3ff] px-2.5 text-[13px] font-medium text-[#2c84db] transition-colors hover:bg-[#ddebff]"
                  >
                    {composeChipHovered ? (
                      <X className="icon-lg" />
                    ) : (
                      <composeMeta.icon className="icon-lg" />
                    )}
                    <span>{composeMeta.label}</span>
                  </button>
                  <div className="min-w-0 flex-1" />
                  <div className="mb-0.5 flex shrink-0 items-center gap-1">
                    {renderTrailingActions(true)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-2.5 sm:py-2">
                {renderAddMenuButton()}
                <div className="min-w-0 flex-1">
                  {renderTextarea("Ask anything")}
                </div>
                <div className="mb-0.5 flex shrink-0 items-center gap-1">
                  {renderTrailingActions()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {isConversationStarted ? (
        <div
          data-context-footer
          className={cn(
            "mt-2 w-full max-w-full sm:max-w-[min(768px,calc(100vw-2.5rem))]",
          )}
        >
          <p className="px-1 text-center text-[11px] leading-4 text-zinc-400 sm:text-xs">
            Clauxen can make mistakes. Check important info.
          </p>
        </div>
      ) : null}
      <VoiceCall
        isOpen={voiceCallOpen}
        onClose={() => setVoiceCallOpen(false)}
      />
    </>
  );
}
