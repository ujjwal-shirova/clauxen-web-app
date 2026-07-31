"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  LoaderCircle,
  Mic,
  Plus,
  Square,
  Telescope,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  captureDisplayScreenshot,
  ScreenshotCaptureError,
} from "@/lib/capture-display-screenshot";
import {
  PromptAddMenuPanel,
  type PromptComposeAction,
  type ThinkingMode,
  type WebSearchMode,
} from "./prompt-add-menu";
import { ComposerProjectStrip } from "./composer-project-strip";
import {
  PromptInlineModeChip,
  type PromptInlineMode,
} from "./prompt-inline-mode-chip";
import { HintTooltip } from "./ui/hint-tooltip";
import { useIsClient } from "@/hooks/use-is-client";
import { MessageQueuePanel } from "./message-queue-panel";
import type { ChatModelId } from "@/lib/chat-models";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import type { QueuedChatMessage } from "@/stores/chat-store";
import {
  COMPOSER_FILE_ACCEPT,
  classifyComposerFile,
  readTextPreview,
  type ComposerAttachment,
  type SendMessageOptions,
} from "@/lib/composer-attachments";
import { AttachmentChip } from "@/components/composer/attachment-chip";
import { AttachmentImageLightbox } from "@/components/composer/attachment-image-lightbox";
import { AttachmentDocumentPreview } from "@/components/composer/attachment-document-preview";
import * as settingsApi from "@/lib/api/settings";
import { overlayToHash } from "@/lib/app-routes";

function openOverlayHash(
  overlay: Parameters<typeof overlayToHash>[0],
) {
  const hash = overlayToHash(overlay);
  if (typeof window === "undefined") return;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

interface PromptInputProps {
  onSendMessage: (prompt: string, options?: SendMessageOptions) => void;
  onStopGeneration: () => void;
  onScrollToBottom?: () => void;
  showScrollToBottomButton?: boolean;
  isConversationStarted: boolean;
  isGenerating: boolean;
  queuedMessages?: QueuedChatMessage[];
  onEditQueuedMessage?: (id: string, content: string) => void;
  onSendQueuedMessageNow?: (id: string) => void;
  onRemoveQueuedMessage?: (id: string) => void;
  /** Fires on every draft change so parent layouts can react without lifting full state. */
  onPromptChange?: (value: string) => void;
  /** Fires when the + menu opens or closes (legacy hook for composer resize). */
  onAddMenuOpenChange?: (open: boolean) => void;
  /** When this value changes (e.g. new chat), the textarea is focused again. */
  focusKey?: string;
  onUpgradeClick?: () => void;
  homerReasoningEffort?: HomerReasoningEffort;
  onHomerReasoningEffortChange?: (effort: HomerReasoningEffort) => void;
  /** Live Thinking toggle — forwarded to /generate as extendedThinking. */
  extendedThinking?: boolean;
  onExtendedThinkingChange?: (enabled: boolean) => void;
  /** Hide model selector in the toolbar (e.g. when shown in the welcome header). */
  showModelSelector?: boolean;
  chatModel?: ChatModelId;
  onChatModelChange?: (model: ChatModelId) => void;
  /** When the active chat already belongs to a project. */
  lockedProjectId?: string | null;
  /** Show the attached project strip under the composer (default on). */
  showProjectStrip?: boolean;
  /** Override the default “Ask anything” placeholder. */
  placeholder?: string;
  /** When false, hide file attach / drag-drop (Incognito). */
  allowAttachments?: boolean;
  /** Visual variant — Incognito uses a dashed border shell. */
  composerVariant?: "default" | "incognito";
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
};

const addMenuTriggerClass =
  "menu-trigger-active flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

const WAVE_DOT_COUNT = 36;
/** Fallback single-line height when measurement is not ready yet. */
const COLLAPSED_TEXTAREA_HEIGHT_PX = 20;
const MAX_PROMPT_LINES = 7;
const PROMPT_NOTIFY_DEBOUNCE_MS = 120;

/** Measure full content height without min-height / max-height constraints. */
function measureTextareaScrollHeight(textarea: HTMLTextAreaElement): number {
  const previous = {
    height: textarea.style.height,
    minHeight: textarea.style.minHeight,
    maxHeight: textarea.style.maxHeight,
    overflow: textarea.style.overflow,
  };
  textarea.style.height = "0";
  textarea.style.minHeight = "0";
  textarea.style.maxHeight = "none";
  textarea.style.overflow = "hidden";
  const measured = textarea.scrollHeight;
  textarea.style.height = previous.height;
  textarea.style.minHeight = previous.minHeight;
  textarea.style.maxHeight = previous.maxHeight;
  textarea.style.overflow = previous.overflow;
  return measured;
}

export function PromptInput({
  onSendMessage,
  onStopGeneration,
  onScrollToBottom,
  showScrollToBottomButton = false,
  isConversationStarted,
  isGenerating,
  queuedMessages = [],
  onEditQueuedMessage,
  onSendQueuedMessageNow,
  onRemoveQueuedMessage,
  onPromptChange,
  focusKey,
  onAddMenuOpenChange,
  homerReasoningEffort,
  onHomerReasoningEffortChange,
  extendedThinking: extendedThinkingProp,
  onExtendedThinkingChange,
  lockedProjectId = null,
  showProjectStrip = true,
  placeholder = "Ask anything",
  allowAttachments = true,
  composerVariant = "default",
}: PromptInputProps) {
  /** Uncontrolled input — draft lives in the DOM ref, not React state (zero parent re-renders). */
  const [hasDraft, setHasDraft] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
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
  const [activeInlineMode, setActiveInlineMode] =
    useState<PromptInlineMode | null>(null);
  const [webSearchMode, setWebSearchMode] = useState<WebSearchMode>("auto");
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(
    extendedThinkingProp ? "on" : "off",
  );
  const [composeChipHovered, setComposeChipHovered] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] =
    useState<ComposerAttachment | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const [waveLevels, setWaveLevels] = useState<number[]>(() =>
    Array.from({ length: WAVE_DOT_COUNT }, () => 0.12),
  );
  const [isMultiline, setIsMultiline] = useState(false);
  const singleLineHeightRef = useRef(COLLAPSED_TEXTAREA_HEIGHT_PX);
  const isMultilineRef = useRef(false);
  const draftValueRef = useRef("");
  const shellWidthRef = useRef(0);
  const resizeRafRef = useRef<number | null>(null);
  const scheduleResizeTextareaRef = useRef<() => void>(() => {});
  const promptShellRef = useRef<HTMLDivElement>(null);
  const addMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuPanelRef = useRef<HTMLDivElement>(null);
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
  const hasPromptAddons =
    selectedQuickActions.length > 0 ||
    attachments.length > 0 ||
    attachmentError != null;
  const useCompactPromptLayout =
    !isMultiline &&
    !showComposeControls &&
    !showDictationSurface &&
    !hasPromptAddons;
  const isClient = useIsClient();

  const setAddMenuOpen = useCallback(
    (open: boolean) => {
      setIsAddMenuOpen(open);
      onAddMenuOpenChange?.(open);
    },
    [onAddMenuOpenChange],
  );

  useEffect(() => {
    if (!focusKey) return;
    setAddMenuOpen(false);
    setActiveInlineMode(null);
  }, [focusKey, setAddMenuOpen]);

  useEffect(() => {
    if (!isAddMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (addMenuTriggerRef.current?.contains(target)) return;
      if (addMenuPanelRef.current?.contains(target)) return;
      setAddMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isAddMenuOpen, setAddMenuOpen]);

  const readDraft = useCallback(
    () => textareaRef.current?.value ?? draftValueRef.current,
    [],
  );

  const scheduleDraftNotify = useCallback(() => {
    const value = readDraft();
    draftValueRef.current = value;
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
      draftValueRef.current = value;
      if (textareaRef.current) textareaRef.current.value = value;
      const has = value.trim().length > 0;
      setHasDraft(has);
      if (draftNotifyTimeoutRef.current) {
        clearTimeout(draftNotifyTimeoutRef.current);
        draftNotifyTimeoutRef.current = null;
      }
      onPromptChange?.(value);
      if (!has) {
        isMultilineRef.current = false;
        setIsMultiline(false);
      }
      scheduleResizeTextareaRef.current();
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
    const textarea = textareaRef.current;
    if (!textarea) {
      return COLLAPSED_TEXTAREA_HEIGHT_PX * MAX_PROMPT_LINES;
    }
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    const resolvedLineHeight = Number.isFinite(lineHeight) ? lineHeight : 20;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    return Math.ceil(
      paddingTop +
        paddingBottom +
        borderTop +
        borderBottom +
        resolvedLineHeight * MAX_PROMPT_LINES,
    );
  }, []);

  const syncPromptEditorMetrics = useCallback(
    (maxHeight: number, minHeight: number, contentHeight: number) => {
      const shell = promptShellRef.current;
      if (!shell) return;
      shell.style.setProperty(
        "--prompt-input-editor-max-height",
        `${maxHeight}px`,
      );
      shell.style.setProperty(
        "--prompt-input-editor-min-height",
        `${minHeight}px`,
      );
      shell.style.setProperty(
        "--prompt-input-editor-height",
        `${contentHeight}px`,
      );
    },
    [],
  );

  const resizeTextareaRef = useRef<() => void>(() => {});

  const scheduleResizeTextarea = useCallback(() => {
    if (resizeRafRef.current != null) {
      window.cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = null;
      resizeTextareaRef.current();
    });
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || showDictationSurface) return;

    const singleLineHeight = getSingleLineHeight();
    const maxHeight = getTextareaMaxHeight();

    const draft = readDraft();
    const isEmpty = draft.trim().length === 0;
    const hasExplicitNewline = draft.includes("\n");

    // Measure against an unconstrained height so collapse is accurate when
    // the user deletes back to a single line / empty draft.
    const scrollHeight = measureTextareaScrollHeight(textarea);
    const fitsSingleLine =
      isEmpty ||
      (!hasExplicitNewline && scrollHeight <= singleLineHeight + 1);

    if (fitsSingleLine) {
      if (isMultilineRef.current) {
        isMultilineRef.current = false;
        setIsMultiline(false);
      }
    } else if (!isMultilineRef.current) {
      isMultilineRef.current = true;
      setIsMultiline(true);
    }

    const contentHeight = isEmpty ? singleLineHeight : scrollHeight;
    const nextHeight = isEmpty
      ? singleLineHeight
      : Math.min(Math.max(contentHeight, singleLineHeight), maxHeight);

    syncPromptEditorMetrics(maxHeight, singleLineHeight, nextHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.overflowY =
      !isEmpty && scrollHeight > maxHeight + 1 ? "auto" : "hidden";

    const editor = textarea.closest<HTMLElement>("[data-prompt-editor]");
    if (editor) {
      if (isEmpty || fitsSingleLine) {
        editor.style.minHeight = `${singleLineHeight}px`;
      } else {
        editor.style.minHeight = `${nextHeight}px`;
      }
    }
  }, [
    getTextareaMaxHeight,
    getSingleLineHeight,
    readDraft,
    showDictationSurface,
    syncPromptEditorMetrics,
  ]);

  useEffect(() => {
    resizeTextareaRef.current = resizeTextarea;
  }, [resizeTextarea]);

  const assignTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (node) {
        scheduleResizeTextarea();
      }
    },
    [scheduleResizeTextarea],
  );

  const syncDraftImmediateRef = useRef(syncDraftImmediate);

  useEffect(() => {
    syncDraftImmediateRef.current = syncDraftImmediate;
  }, [syncDraftImmediate]);

  useEffect(() => {
    scheduleResizeTextareaRef.current = scheduleResizeTextarea;
  }, [scheduleResizeTextarea]);

  useEffect(() => {
    if (!isClient) return;
    scheduleResizeTextarea();
  }, [isClient, scheduleResizeTextarea]);

  useEffect(() => {
    scheduleResizeTextarea();
  }, [
    isConversationStarted,
    showDictationSurface,
    showComposeControls,
    isMultiline,
    scheduleResizeTextarea,
  ]);

  useEffect(() => {
    const shell = promptShellRef.current;
    if (!shell) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === shellWidthRef.current) return;
      shellWidthRef.current = width;
      getSingleLineHeight();
      scheduleResizeTextarea();
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [getSingleLineHeight, scheduleResizeTextarea]);

  useEffect(() => {
    return () => {
      if (resizeRafRef.current != null) {
        window.cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    syncDraftImmediate("");
    setIsMultiline(false);
    isMultilineRef.current = false;
    singleLineHeightRef.current = COLLAPSED_TEXTAREA_HEIGHT_PX;
    requestAnimationFrame(() => {
      // Prefer a stashed “Create via chat” schedule draft over an empty box.
      void import("@/lib/schedule-chat-draft").then(({ consumeScheduleChatDraft }) => {
        const draft = consumeScheduleChatDraft();
        if (draft) {
          syncDraftImmediate(draft);
          setIsMultiline(draft.includes("\n") || draft.length > 80);
        }
        scheduleResizeTextarea();
        textareaRef.current?.focus({ preventScroll: true });
      });
    });
  }, [focusKey, syncDraftImmediate, scheduleResizeTextarea]);

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
      syncDraftImmediateRef.current(next);
      scheduleResizeTextareaRef.current();
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
    // Allow send while generating — active chat queues; other chats start a stream.
    if (value || attachments.length > 0) {
      const payload = attachments.map((item) => ({ ...item }));
      onSendMessage(value, { attachments: payload });
      syncDraftImmediate("");
      setAttachments([]);
      setAttachmentError(null);
      setActiveInlineMode(null);
      requestAnimationFrame(() => {
        dismissComposerFocus();
      });
    }
  };

  const addAttachment = useCallback((attachment: ComposerAttachment) => {
    setAttachments((prev) => [...prev, attachment]);
    setAttachmentError(null);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      let added = 0;
      for (const file of files) {
        const kind = classifyComposerFile(file);
        if (!kind) {
          setAttachmentError(
            `"${file.name}" is not a supported attachment type.`,
          );
          continue;
        }

        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (kind === "image") {
          const previewUrl = URL.createObjectURL(file);
          addAttachment({
            id,
            name: file.name,
            previewUrl,
            mimeType: file.type || "image/png",
            kind: "image",
            file,
            uploadStatus: "local",
          });
          added += 1;
          continue;
        }

        const textPreview = await readTextPreview(file);
        const previewUrl = URL.createObjectURL(file);
        addAttachment({
          id,
          name: file.name,
          previewUrl,
          mimeType: file.type || "application/octet-stream",
          kind: "document",
          file,
          textPreview: textPreview || undefined,
          uploadStatus: "local",
        });
        added += 1;
      }
      if (added > 0) setAttachmentError(null);
    },
    [addAttachment],
  );

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      await ingestFiles(files);
    },
    [ingestFiles],
  );

  const handleTakeScreenshot = useCallback(async () => {
    if (isCapturingScreenshot) return;
    setAttachmentError(null);
    setIsCapturingScreenshot(true);
    try {
      const shot = await captureDisplayScreenshot();
      const res = await fetch(shot.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], shot.fileName, { type: "image/png" });
      addAttachment({
        id: `screenshot-${Date.now()}`,
        name: shot.fileName,
        previewUrl: shot.dataUrl,
        mimeType: "image/png",
        kind: "image",
        file,
        uploadStatus: "local",
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
    if (!allowAttachments) return;
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
  }, [allowAttachments, openFilePicker]);

  useEffect(() => {
    const shell = promptShellRef.current;
    if (!shell || !allowAttachments) return;

    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      void ingestFiles(Array.from(event.dataTransfer.files));
    };

    shell.addEventListener("dragenter", onDragEnter);
    shell.addEventListener("dragleave", onDragLeave);
    shell.addEventListener("dragover", onDragOver);
    shell.addEventListener("drop", onDrop);
    return () => {
      shell.removeEventListener("dragenter", onDragEnter);
      shell.removeEventListener("dragleave", onDragLeave);
      shell.removeEventListener("dragover", onDragOver);
      shell.removeEventListener("drop", onDrop);
    };
  }, [allowAttachments, ingestFiles]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items?.length) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      if (!files.length) return;
      event.preventDefault();
      void ingestFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFiles]);

  const handleInput = useCallback(() => {
    scheduleDraftNotify();
    scheduleResizeTextarea();
  }, [scheduleDraftNotify, scheduleResizeTextarea]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && activeInlineMode) {
      const textarea = textareaRef.current;
      if (textarea) {
        const atStart =
          textarea.selectionStart === 0 && textarea.selectionEnd === 0;
        const empty = !readDraft().trim();
        if (atStart && empty) {
          e.preventDefault();
          setActiveInlineMode(null);
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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

  useEffect(() => {
    let cancelled = false;
    void settingsApi
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        setWebSearchMode(
          settings.personalization?.webSearch === false ? "off" : "auto",
        );
        setThinkingMode(
          settings.personalization?.extendedThinking === true ? "on" : "off",
        );
        onExtendedThinkingChange?.(
          settings.personalization?.extendedThinking === true,
        );
      })
      .catch(() => {
        // Keep optimistic default when settings are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleWebSearchModeChange = useCallback((mode: WebSearchMode) => {
    setWebSearchMode(mode);
    void settingsApi
      .updateSettings({
        personalization: { webSearch: mode === "auto" },
      })
      .catch((error) => {
        console.warn("[composer] web search preference failed:", error);
      });
  }, []);

  const handleThinkingModeChange = useCallback((mode: ThinkingMode) => {
    setThinkingMode(mode);
    onExtendedThinkingChange?.(mode === "on");
    void settingsApi
      .updateSettings({
        personalization: { extendedThinking: mode === "on" },
      })
      .catch((error) => {
        console.warn("[composer] thinking preference failed:", error);
      });
  }, [onExtendedThinkingChange]);

  useEffect(() => {
    if (extendedThinkingProp == null) return;
    setThinkingMode(extendedThinkingProp ? "on" : "off");
  }, [extendedThinkingProp]);

  const handleComposeActionRemove = () => {
    setActiveComposeAction(null);
    scheduleResizeTextarea();
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
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

  const withProjectStrip = showProjectStrip;
  const promptShellClass = cn(
    "relative w-full max-w-full bg-white transition-[min-height,border-color,background-color] duration-200 ease-out",
    withProjectStrip && "composer-shell--with-project-strip",
    showComposeControls && "min-h-[96px]",
    composerVariant === "incognito" &&
      "rounded-[22px] border border-dashed border-zinc-300/90 shadow-none",
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
        <Mic className="icon-xl shrink-0 opacity-80 sm:icon-xl" />
      </button>
    </HintTooltip>
  );

  const renderDisabledSendButton = () => (
    <HintTooltip content="Send">
      <button
        type="button"
        disabled
        aria-label="Send"
        className="no-hover-overlay flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-zinc-900 text-white opacity-40"
      >
        <ArrowUp className="icon-xl" />
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
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isTranscribing
                  ? "cursor-wait bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {isTranscribing ? (
                <LoaderCircle className="icon-md animate-spin" />
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
        {renderModelSelector()}
        {renderMicButton()}
        {isGenerating ? (
          hasDraft || attachments.length > 0 ? (
            <HintTooltip content="Send (queue while generating)">
              <button
                type="button"
                onClick={handleSubmit}
                aria-label="Send queued message"
                className="no-hover-overlay flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition-all duration-200 hover:bg-zinc-800 data-app-button"
                data-app-button
              >
                <ArrowUp className="icon-xl" />
              </button>
            </HintTooltip>
          ) : (
            <HintTooltip content="Stop generating">
              <button
                type="button"
                onClick={onStopGeneration}
                aria-label="Stop generating"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white transition-all duration-200 hover:bg-zinc-900 data-app-button"
                data-app-button
              >
                <Square className="size-5 fill-current" />
              </button>
            </HintTooltip>
          )
        ) : hasDraft || attachments.length > 0 ? (
          <HintTooltip content="Send">
            <button
              type="button"
              onClick={handleSubmit}
              aria-label="Send"
              className="no-hover-overlay flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition-all duration-200 hover:bg-zinc-800 data-app-button"
              data-app-button
            >
              <ArrowUp className="icon-xl" />
            </button>
          </HintTooltip>
        ) : (
          renderDisabledSendButton()
        )}
      </>
    );
  };

  const renderAddMenuButton = () => (
    <div className="relative shrink-0" data-prompt-add-anchor>
      <button
        ref={addMenuTriggerRef}
        type="button"
        aria-label="Add content"
        aria-expanded={isAddMenuOpen}
        disabled={isCapturingScreenshot}
        onClick={() => setAddMenuOpen(!isAddMenuOpen)}
        className={cn(
          addMenuTriggerClass,
          isAddMenuOpen && "border-zinc-300 bg-zinc-100 text-zinc-800",
          isCapturingScreenshot && "opacity-50",
        )}
      >
        <Plus
          className="icon-xl shrink-0 opacity-80 sm:icon-xl"
          strokeWidth={1.75}
        />
      </button>
      <PromptAddMenuPanel
        open={isAddMenuOpen}
        placement="above"
        anchorRef={addMenuTriggerRef}
        panelRef={addMenuPanelRef}
        onClose={() => setAddMenuOpen(false)}
        onAddFiles={allowAttachments ? openFilePicker : undefined}
        webSearchMode={webSearchMode}
        onWebSearchModeChange={handleWebSearchModeChange}
        thinkingMode={thinkingMode}
        onThinkingModeChange={handleThinkingModeChange}
        onOpenPlugins={() => openOverlayHash({ type: "apps" })}
        onOpenSkills={() =>
          openOverlayHash({ type: "settings", tab: "Skills" })
        }
      />
    </div>
  );

  const renderModelSelector = () => null;

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


  const renderPromptBody = (placeholder: string, centerSlot?: ReactNode) => {
    return (
      <div
        className={cn(
          "prompt-body-grid w-full flex flex-col",
          useCompactPromptLayout && "prompt-body-grid--compact flex-row items-center gap-2 px-2.5 py-2 sm:px-3 min-h-[56px]"
        )}
        data-prompt-layout={useCompactPromptLayout ? "compact" : "stacked"}
      >
        <div
          className={cn(
            "prompt-editor-area min-w-0",
            useCompactPromptLayout ? "order-2 flex-1" : "w-full px-2.5 pt-1.5 pb-0 sm:px-3",
          )}
          data-prompt-editor
        >
          {renderTextareaField(placeholder, useCompactPromptLayout ? "py-0" : undefined)}
        </div>

        <div
          className={cn(
            "prompt-toolbar-area flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-2.5 sm:py-2",
            useCompactPromptLayout && "contents"
          )}
        >
          <div className={cn(useCompactPromptLayout && "order-1")}>
            {renderAddMenuButton()}
          </div>
          <div className={cn(useCompactPromptLayout && "hidden")}>
            {centerSlot}
          </div>
          <div className={cn("prompt-toolbar-spacer min-w-0 flex-1", useCompactPromptLayout && "hidden")} />
          <div className={cn("prompt-trailing-actions flex shrink-0 items-center gap-1", useCompactPromptLayout && "order-3")}>
            {renderTrailingActions()}
          </div>
        </div>
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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0">
        {activeInlineMode ? (
          <PromptInlineModeChip mode={activeInlineMode} />
        ) : null}
        <textarea
          ref={assignTextareaRef}
          placeholder={placeholder}
          defaultValue={draftValueRef.current}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={scheduleResizeTextarea}
          onCompositionEnd={scheduleResizeTextarea}
          className={cn(
            "prompt-textarea block min-w-[3rem] min-h-0 flex-1 resize-none overflow-x-hidden border-0 bg-transparent text-[14px] font-[430] leading-[20px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-[14px] sm:leading-[21px]",
            showComposeControls ? "px-1 py-1.5" : "px-0 py-1",
            className,
          )}
          data-prompt-multiline={isMultiline || undefined}
          rows={1}
        />
      </div>
    );

  // Always paint the real composer — no client-only stub / skeleton swap.
  return (
    <>
      <div
        className={cn(
          "flex w-full flex-col",
          isConversationStarted ? "items-stretch" : "items-center",
        )}
        data-prompt-root
        data-streaming={isGenerating || undefined}
        suppressHydrationWarning
      >
        <div
          className={cn(
            "relative flex w-full flex-col",
            !isConversationStarted && "justify-center",
            isAddMenuOpen && "overflow-visible",
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
                <ArrowDown className="size-5" />
              </button>
            </HintTooltip>
          )}

          {queuedMessages.length > 0 &&
          onEditQueuedMessage &&
          onSendQueuedMessageNow &&
          onRemoveQueuedMessage ? (
            <MessageQueuePanel
              items={queuedMessages}
              onEdit={onEditQueuedMessage}
              onSendNow={onSendQueuedMessageNow}
              onRemove={onRemoveQueuedMessage}
            />
          ) : null}

          <div
            className={cn(
              "composer-stack w-full",
              withProjectStrip && "composer-stack--with-project",
              isAddMenuOpen && "overflow-visible",
            )}
            data-composer-stack={withProjectStrip ? "with-project" : "solo"}
            data-add-menu-open={isAddMenuOpen || undefined}
          >
          <div
            className={cn(
              promptShellClass,
              isDraggingFiles && "ring-2 ring-[#2c84db]/35",
              isAddMenuOpen && "overflow-visible",
            )}
            ref={promptShellRef}
            data-prompt-shell
            data-compose-mode={showComposeControls || undefined}
            data-drop-active={isDraggingFiles || undefined}
            data-add-menu-open={isAddMenuOpen || undefined}
          >
            {isDraggingFiles ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-[#2c84db]/50 bg-[#e9f3ff]/70 text-[13px] font-medium text-[#2c84db]">
                Drop files to attach
              </div>
            ) : null}
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
                    <AttachmentChip
                      key={attachment.id}
                      file={attachment}
                      onRemove={() => removeAttachment(attachment.id)}
                      onOpen={() => setPreviewAttachment(attachment)}
                    />
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
              accept={COMPOSER_FILE_ACCEPT}
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
                    <X className="icon-xl" />
                  ) : (
                    <composeMeta.icon className="icon-xl" />
                  )}
                  <span>{composeMeta.label}</span>
                </button>,
              )
            ) : (
              renderPromptBody(placeholder)
            )}
          </div>
          {withProjectStrip ? (
            <ComposerProjectStrip lockedProjectId={lockedProjectId} />
          ) : null}
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

      <AttachmentImageLightbox
        open={previewAttachment?.kind === "image"}
        name={previewAttachment?.name ?? ""}
        previewUrl={previewAttachment?.previewUrl ?? ""}
        onClose={() => setPreviewAttachment(null)}
      />
      <AttachmentDocumentPreview
        open={previewAttachment?.kind === "document"}
        name={previewAttachment?.name ?? ""}
        mimeType={previewAttachment?.mimeType ?? ""}
        previewUrl={previewAttachment?.previewUrl}
        textPreview={previewAttachment?.textPreview}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
