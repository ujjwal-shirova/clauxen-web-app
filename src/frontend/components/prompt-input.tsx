"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  ImageIcon,
  LoaderCircle,
  Mic,
  RectangleHorizontal,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { VoiceCall } from "./voice-call";
import { PlusIcon } from "./icons";
import { PromptAddMenu } from "./prompt-add-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { HintTooltip } from "./ui/hint-tooltip";

interface PromptInputProps {
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  onScrollToBottom?: () => void;
  showScrollToBottomButton?: boolean;
  isConversationStarted: boolean;
  isGenerating: boolean;
  /** Fires on every draft change so parent layouts can react without lifting full state. */
  onPromptChange?: (value: string) => void;
  /** Exposes new-chat image composition mode for the surrounding welcome content. */
  onImageModeChange?: (enabled: boolean) => void;
  imageModeEnabled?: boolean;
  /** When this value changes (e.g. new chat), the textarea is focused again. */
  focusKey?: string;
  onUpgradeClick?: () => void;
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  /** Hide model selector in the toolbar (e.g. when shown in the welcome header). */
  showModelSelector?: boolean;
  /** On dedicated image generation pages, show the image icon instead of the generic plus icon for the add/attachment button. */
  replaceAddButtonWithImage?: boolean;
}

const RESPONSE_SPEEDS = ["Instant", "Thinking"] as const;
const IMAGE_RATIOS = ["Auto", "Square", "Landscape", "Portrait"] as const;

export function PromptInput({
  onSendMessage,
  onStopGeneration,
  onScrollToBottom,
  showScrollToBottomButton = false,
  isConversationStarted,
  isGenerating,
  onPromptChange,
  onImageModeChange,
  imageModeEnabled,
  focusKey,
  thinkingEnabled = false,
  onThinkingEnabledChange,
  showModelSelector = true,
  replaceAddButtonWithImage = false,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedQuickActions, setSelectedQuickActions] = useState<
    Array<"image" | "video" | "music" | "deep-research">
  >([]);
  const [imageRatio, setImageRatio] =
    useState<(typeof IMAGE_RATIOS)[number]>("Auto");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldSubmitRecordingRef = useRef(false);
  const isImageMode =
    imageModeEnabled ?? selectedQuickActions.includes("image");
  const showImageControls = isImageMode && !isConversationStarted;
  const showDictationSurface = isDictating || isTranscribing;

  useEffect(() => {
    onPromptChange?.(prompt);
  }, [prompt, onPromptChange]);

  useEffect(() => {
    if (isConversationStarted) {
      setSelectedQuickActions((prev) =>
        prev.filter((action) => action !== "image"),
      );
    }
  }, [isConversationStarted]);

  // Auto-resize logic with line limit (smaller cap on mobile welcome screen)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const maxHeight = isConversationStarted ? 200 : 140;
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY =
        textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [prompt, isConversationStarted, showDictationSurface]);

  useEffect(() => {
    setPrompt("");
    const textarea = textareaRef.current;
    if (!textarea) return;
    const t = window.setTimeout(() => {
      textarea.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [focusKey]);

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
      setPrompt((prev) => prev + ch);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const handleSubmit = () => {
    if (prompt.trim() && !isGenerating) {
      onSendMessage(prompt);
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      handleSubmit();
    }
  };

  const quickActionLabelMap: Record<
    "image" | "video" | "music" | "deep-research",
    string
  > = {
    image: "Image",
    video: "Video",
    music: "Music",
    "deep-research": "Deep research",
  };

  const handleQuickActionSelect = (
    action: "image" | "video" | "music" | "deep-research",
  ) => {
    if (action === "image" && isConversationStarted) return;
    if (action === "image" && onImageModeChange) {
      onImageModeChange(true);
      return;
    }
    setSelectedQuickActions((prev) =>
      prev.includes(action) ? prev : [...prev, action],
    );
  };

  const handleQuickActionRemove = (
    action: "image" | "video" | "music" | "deep-research",
  ) => {
    setSelectedQuickActions((prev) => prev.filter((item) => item !== action));
    if (action === "image") {
      setImageRatio("Auto");
      onImageModeChange?.(false);
    }
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
            setPrompt((previous) =>
              previous && !/\s$/.test(previous)
                ? `${previous} ${transcript}`
                : previous + transcript,
            );
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

  const hasDraft = prompt.trim().length > 0;
  const micButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10";

  const voiceModeButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10";

  return (
    <>
      <div
        className="flex w-full flex-col items-center"
        data-prompt-root
        data-streaming={isGenerating || undefined}
      >
        <div className="relative flex w-full justify-center">
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
            className={cn(
              "w-full overflow-hidden transition-[min-height,box-shadow,border-color] duration-200 ease-out",
              isConversationStarted
                ? "max-w-[min(768px,calc(100vw-1.5rem))] sm:max-w-[min(768px,calc(100vw-2.5rem))]"
                : "max-w-full sm:max-w-[min(720px,calc(100vw-2.5rem))]",
            )}
          >
            <div className="flex h-full min-h-[56px] flex-col px-3 py-2 sm:min-h-[58px] sm:px-4 sm:py-2.5">
              <div className="min-w-0 flex-1 px-0.5 pt-0.5 sm:px-1 sm:pt-1">
                <AnimatePresence initial={false} mode="wait">
                  {showDictationSurface ? (
                    <motion.div
                      key="dictation-waveform"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.18 }}
                      className="flex h-14 min-w-0 items-center overflow-hidden"
                    >
                      {isTranscribing ? (
                        <div className="flex w-full items-center gap-2 text-[14px] text-zinc-500">
                          <LoaderCircle className="icon-md animate-spin" />
                          <span>Transcribing...</span>
                        </div>
                      ) : (
                        <canvas
                          ref={waveformRef}
                          height={112}
                          width={1456}
                          aria-label="Voice recording waveform"
                          className="h-14 w-full align-middle"
                        />
                      )}
                    </motion.div>
                  ) : (
                    <motion.textarea
                      key="prompt-field"
                      ref={textareaRef}
                      placeholder="Ask anything"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="block min-h-[32px] w-full resize-none border-0 bg-transparent py-1.5 text-[15px] font-[430] leading-[22px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-[15px] sm:leading-[23px]"
                      rows={1}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <PromptAddMenu
                    onQuickActionSelect={handleQuickActionSelect}
                    showImageCreation={!isConversationStarted}
                    trigger={
                      <button
                        type="button"
                        aria-label={replaceAddButtonWithImage ? "Image options" : "Add content"}
                        className="menu-trigger-active flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900"
                      >
                        {replaceAddButtonWithImage ? (
                          <ImageIcon className="h-5 w-5 shrink-0" />
                        ) : (
                          <PlusIcon className="h-5 w-5 shrink-0" />
                        )}
                      </button>
                    }
                  />
                  <AnimatePresence initial={false} mode="popLayout">
                    {showImageControls ? (
                      <motion.div
                        key="image-compose-controls"
                        initial={{ opacity: 0, x: -6, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -4, scale: 0.98 }}
                        transition={{
                          duration: 0.22,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          aria-label="Image, click to remove"
                          onClick={() => handleQuickActionRemove("image")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#2c84db]/15 bg-[#e9f3ff] px-2.5 text-[14px] text-[#2c84db] transition-colors hover:bg-[#ddebff]"
                        >
                          <ImageIcon className="icon-xl" />
                          <span>Image</span>
                          <X className="icon-sm" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Choose image aspect ratio"
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-transparent px-2.5 text-[14px] text-zinc-600 hover:bg-zinc-100 data-[state=open]:bg-zinc-100"
                            >
                              <RectangleHorizontal className="icon-xl" />
                              <span>{imageRatio}</span>
                              <ChevronDown className="icon-sm" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            side="top"
                            sideOffset={8}
                          >
                            {IMAGE_RATIOS.map((ratio) => (
                              <DropdownMenuItem
                                key={ratio}
                                onSelect={() => setImageRatio(ratio)}
                              >
                                {ratio}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ) : selectedQuickActions.some(
                        (action) => action !== "image",
                      ) ? (
                      <motion.div
                        key="other-compose-controls"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -4 }}
                        className="flex items-center gap-1.5"
                      >
                        {selectedQuickActions
                          .filter((action) => action !== "image")
                          .map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => handleQuickActionRemove(action)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-transparent px-2.5 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50"
                            >
                              <span>{quickActionLabelMap[action]}</span>
                              <X className="icon-sm" />
                            </button>
                          ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {onThinkingEnabledChange &&
                  (showModelSelector || !isConversationStarted) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          data-speed-toggle
                          data-active={thinkingEnabled ? "true" : undefined}
                          className="inline-flex h-9 max-w-[112px] items-center gap-1.5 rounded-full bg-transparent px-3 text-[14px] text-zinc-500 hover:bg-zinc-100 data-[state=open]:bg-zinc-100 data-app-button"
                        >
                          <span>
                            {thinkingEnabled ? "Thinking" : "Instant"}
                          </span>
                          <ChevronDown className="icon-sm" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        side="top"
                        sideOffset={8}
                      >
                        {RESPONSE_SPEEDS.map((speed) => {
                          const isActive = (speed === "Thinking") === thinkingEnabled;
                          return (
                            <DropdownMenuItem
                              key={speed}
                              onSelect={() =>
                                onThinkingEnabledChange(speed === "Thinking")
                              }
                              className={cn(
                                isActive && "bg-black/[0.06] font-medium",
                              )}
                            >
                              {speed}
                              {isActive && <Check className="ml-auto h-3.5 w-3.5 opacity-60" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {showDictationSurface ? (
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
                  ) : (
                    <HintTooltip content="Dictate">
                      <button
                        type="button"
                        onClick={startDictation}
                        disabled={isGenerating}
                        aria-pressed={isDictating}
                          className={cn(
                            micButtonClass,
                            "border border-zinc-200 text-zinc-600",
                            isGenerating && "opacity-40",
                          )}
                          data-app-button
                        >
                        <Mic className="icon-lg shrink-0 opacity-80 sm:icon-xl" />
                      </button>
                    </HintTooltip>
                  )}

                  {!showDictationSurface && isGenerating ? (
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
                  ) : !showDictationSurface && hasDraft ? (
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
                  ) : !showDictationSurface ? (
                    <HintTooltip content="Voice Mode.">
                      <button
                        type="button"
                        onClick={() => setVoiceCallOpen(true)}
                        className={voiceModeButtonClass}
                      >
                        <AudioLines className="icon-lg shrink-0 opacity-80 sm:icon-xl" />
                      </button>
                    </HintTooltip>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <VoiceCall
        isOpen={voiceCallOpen}
        onClose={() => setVoiceCallOpen(false)}
      />
    </>
  );
}
