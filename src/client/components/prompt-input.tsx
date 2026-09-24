"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
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
import {
  PromptInlineModeChip,
  type PromptInlineMode,
} from "./prompt-inline-mode-chip";
import { HintTooltip } from "./ui/hint-tooltip";
import { useIsClient } from "@/hooks/use-is-client";
import { MessageQueuePanel } from "./message-queue-panel";
import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/chat-models";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import { PromptModelSelector } from "./prompt-model-selector";
import {
  useActiveChatId,
  type QueuedChatMessage,
} from "@/stores/chat-store";
import {
  COMPOSER_FILE_ACCEPT,
  classifyComposerFile,
  readTextPreview,
  type ComposerAttachment,
  type SendMessageOptions,
} from "@/lib/composer-attachments";
import {
  beginComposerAttachmentWork,
  cancelComposerAttachment,
} from "@/lib/composer-upload";
import { AttachmentChip } from "@/components/composer/attachment-chip";
import { AttachmentPreviewHost } from "@/components/composer/attachment-preview-host";
import { ComposerAttachmentStrip } from "@/components/composer/attachment-strip";
import * as settingsApi from "@/lib/api/settings";
import { overlayToHash } from "@/lib/app-routes";
import { useStreamingDictation } from "@/features/dictation/use-streaming-dictation";
import type { CaretRange } from "@/features/dictation/transcript";

function openOverlayHash(overlay: Parameters<typeof overlayToHash>[0]) {
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
  isFreePlan?: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
  onHomerReasoningEffortChange?: (effort: HomerReasoningEffort) => void;
  /** Live Thinking toggle — forwarded to /generate as extendedThinking. */
  extendedThinking?: boolean;
  onExtendedThinkingChange?: (enabled: boolean) => void;
  /** Hide model selector in the toolbar (e.g. when shown in the welcome header). */
  showModelSelector?: boolean;
  chatModel?: ChatModelId;
  onChatModelChange?: (model: ChatModelId) => void;
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
  "menu-trigger-active no-hover-overlay prompt-control-ghost shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

const WELCOME_HINTS = [
  "Ask anything",
  "Type / for skills",
  "Type @ for files",
  "Type # for plugins",
] as const;

const promptFilledControlClass =
  "no-hover-overlay prompt-control-filled shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-app-button";

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
    transition: textarea.style.transition,
  };
  // Disable height transition while probing — otherwise the measure
  // momentarily collapses to 0 and animates back (hard cut / flicker).
  textarea.style.transition = "none";
  textarea.style.height = "0";
  textarea.style.minHeight = "0";
  textarea.style.maxHeight = "none";
  textarea.style.overflow = "hidden";
  // Force reflow so the zero-height probe is applied before reading.
  void textarea.offsetHeight;
  const measured = textarea.scrollHeight;
  textarea.style.height = previous.height;
  textarea.style.minHeight = previous.minHeight;
  textarea.style.maxHeight = previous.maxHeight;
  textarea.style.overflow = previous.overflow;
  void textarea.offsetHeight;
  textarea.style.transition = previous.transition;
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
  onUpgradeClick,
  isFreePlan = false,
  homerReasoningEffort,
  onHomerReasoningEffortChange,
  extendedThinking: extendedThinkingProp,
  onExtendedThinkingChange,
  showModelSelector = true,
  chatModel = DEFAULT_CHAT_MODEL_ID,
  onChatModelChange,
  placeholder = "Ask anything",
  allowAttachments = true,
  composerVariant = "default",
}: PromptInputProps) {
  const activeChatId = useActiveChatId();
  /** Uncontrolled input — draft lives in the DOM ref, not React state (zero parent re-renders). */
  const [hasDraft, setHasDraft] = useState(false);
  const [composerMode, setComposerMode] = useState<"chat" | "collabry">("chat");
  const [hintIndex, setHintIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const draftNotifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const syncDraftImmediateRef = useRef<(value: string) => void>(() => {});
  const applyingDictationRef = useRef(false);
  const readDraftForDictation = useCallback(
    () => textareaRef.current?.value ?? draftValueRef.current,
    [],
  );
  const readCaretForDictation = useCallback((): CaretRange => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const len = draftValueRef.current.length;
      return { start: len, end: len };
    }
    return {
      start: textarea.selectionStart ?? textarea.value.length,
      end: textarea.selectionEnd ?? textarea.value.length,
    };
  }, []);
  const applyDictationDraft = useCallback((value: string, caret: CaretRange) => {
    applyingDictationRef.current = true;
    syncDraftImmediateRef.current(value);
    const textarea = textareaRef.current;
    if (textarea) {
      const start = Math.max(0, Math.min(caret.start, textarea.value.length));
      const end = Math.max(start, Math.min(caret.end, textarea.value.length));
      textarea.setSelectionRange(start, end);
    }
    queueMicrotask(() => {
      applyingDictationRef.current = false;
    });
  }, []);
  const dictation = useStreamingDictation({
    readDraft: readDraftForDictation,
    readCaret: readCaretForDictation,
    onDraftChange: applyDictationDraft,
  });
  const showComposeControls =
    activeComposeAction != null && !isConversationStarted;
  const composeMeta = activeComposeAction
    ? COMPOSE_ACTION_META[activeComposeAction]
    : null;
  const showDictationActions =
    dictation.status === "listening" || dictation.status === "stopping";
  const dictationConnecting = dictation.status === "connecting";
  const hasPromptAddons =
    selectedQuickActions.length > 0 ||
    attachments.length > 0 ||
    attachmentError != null;
  const useCompactPromptLayout =
    !isMultiline && !showComposeControls && !hasPromptAddons;
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
    if (!textarea) return;

    const singleLineHeight = getSingleLineHeight();
    const maxHeight = getTextareaMaxHeight();

    const draft = readDraft();
    const isEmpty = draft.trim().length === 0;
    const hasExplicitNewline = draft.includes("\n");

    // Measure against an unconstrained height so collapse is accurate when
    // the user deletes back to a single line / empty draft.
    const scrollHeight = measureTextareaScrollHeight(textarea);
    const fitsSingleLine =
      isEmpty || (!hasExplicitNewline && scrollHeight <= singleLineHeight + 1);

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
    showDictationActions,
    showComposeControls,
    isMultiline,
    dictation.status,
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
      void import("@/lib/schedule-chat-draft").then(
        ({ consumeScheduleChatDraft }) => {
          const draft = consumeScheduleChatDraft();
          if (draft) {
            syncDraftImmediate(draft);
            setIsMultiline(draft.includes("\n") || draft.length > 80);
          }
          scheduleResizeTextarea();
          textareaRef.current?.focus({ preventScroll: true });
        },
      );
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

  const patchAttachment = useCallback(
    (id: string, patch: Partial<ComposerAttachment>) => {
      setAttachments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      setPreviewAttachment((current) =>
        current?.id === id ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const armComposerAttachment = useCallback(
    (attachment: ComposerAttachment) => {
      const skipUpload =
        !allowAttachments || composerVariant === "incognito";
      addAttachment({
        ...attachment,
        uploadStatus: skipUpload
          ? attachment.uploadStatus ?? "local"
          : "uploading",
      });
      beginComposerAttachmentWork(attachment, {
        chatId: activeChatId,
        skipUpload,
        onUpdate: patchAttachment,
      });
    },
    [
      activeChatId,
      addAttachment,
      allowAttachments,
      composerVariant,
      patchAttachment,
    ],
  );

  const removeAttachment = useCallback((id: string) => {
    cancelComposerAttachment(id);
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
        if (kind === "image" || kind === "video") {
          const previewUrl = URL.createObjectURL(file);
          armComposerAttachment({
            id,
            name: file.name,
            previewUrl,
            mimeType:
              file.type || (kind === "video" ? "video/mp4" : "image/png"),
            kind,
            file,
            uploadStatus: "uploading",
          });
          added += 1;
          continue;
        }

        const textPreview = await readTextPreview(file);
        const previewUrl = URL.createObjectURL(file);
        armComposerAttachment({
          id,
          name: file.name,
          previewUrl,
          mimeType: file.type || "application/octet-stream",
          kind: "document",
          file,
          textPreview: textPreview || undefined,
          uploadStatus: "uploading",
        });
        added += 1;
      }
      if (added > 0) setAttachmentError(null);
    },
    [armComposerAttachment],
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
      armComposerAttachment({
        id: `screenshot-${Date.now()}`,
        name: shot.fileName,
        previewUrl: shot.dataUrl,
        mimeType: "image/png",
        kind: "image",
        file,
        uploadStatus: "uploading",
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
  }, [armComposerAttachment, isCapturingScreenshot]);

  useEffect(() => {
    if (!allowAttachments) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "u"
      ) {
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

    if (e.key === "Escape" && dictation.isActive) {
      e.preventDefault();
      void dictation.cancel();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (dictation.isActive) {
        if (showDictationActions) void dictation.submit();
        return;
      }
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

  const handleThinkingModeChange = useCallback(
    (mode: ThinkingMode) => {
      setThinkingMode(mode);
      onExtendedThinkingChange?.(mode === "on");
      void settingsApi
        .updateSettings({
          personalization: { extendedThinking: mode === "on" },
        })
        .catch((error) => {
          console.warn("[composer] thinking preference failed:", error);
        });
    },
    [onExtendedThinkingChange],
  );

  useEffect(() => {
    if (extendedThinkingProp == null) return;
    setThinkingMode(extendedThinkingProp ? "on" : "off");
  }, [extendedThinkingProp]);

  const handleComposeActionRemove = () => {
    setActiveComposeAction(null);
    scheduleResizeTextarea();
  };

  const promptIsExpanded =
    isMultiline || showComposeControls || hasPromptAddons;
  const promptShellClass = cn(
    "relative w-full max-w-full bg-[var(--chat-user-card-bg,#ffffff)] transition-[min-height,border-color,background-color,box-shadow] duration-300 ease-out rounded-[var(--prompt-radius)]",
    showComposeControls && "min-h-[40px]",
    composerVariant === "incognito" &&
      "border border-dashed border-zinc-300/90 shadow-none",
  );

  const renderMicButton = () => (
    <HintTooltip content={dictationConnecting ? "Connecting…" : "Dictate"}>
      <button
        type="button"
        onClick={() => {
          if (dictationConnecting) return;
          void dictation.start();
        }}
        disabled={dictationConnecting}
        aria-pressed={dictation.isActive}
        aria-busy={dictationConnecting || undefined}
        aria-label={dictationConnecting ? "Connecting dictation" : "Dictate"}
        className={cn(
          "no-hover-overlay prompt-control-ghost shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
          dictationConnecting && "cursor-wait opacity-80",
        )}
        data-app-button
      >
        {dictationConnecting ? (
          <LoaderCircle
            className="icon-sm shrink-0 animate-spin"
            strokeWidth={1.75}
            aria-hidden
          />
        ) : (
          <Mic className="icon-sm shrink-0" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </HintTooltip>
  );

  const renderDisabledSendButton = () => (
    <HintTooltip content="Send">
      <button
        type="button"
        disabled
        aria-label="Send"
        className={cn(promptFilledControlClass, "cursor-not-allowed")}
      >
        <ArrowUp className="icon-sm" strokeWidth={2} />
      </button>
    </HintTooltip>
  );

  const renderTrailingActions = () => {
    if (showDictationActions) {
      return (
        <>
          <HintTooltip content="Cancel dictation">
            <button
              type="button"
              onClick={() => void dictation.cancel()}
              disabled={dictation.status === "stopping"}
              aria-label="Cancel dictation"
              className={cn(
                "no-hover-overlay prompt-control-ghost",
                dictation.status === "stopping" &&
                  "cursor-not-allowed opacity-40",
              )}
            >
              <X className="icon-md" strokeWidth={1.75} />
            </button>
          </HintTooltip>
          <HintTooltip content="Submit dictation">
            <button
              type="button"
              onClick={() => void dictation.submit()}
              disabled={dictation.status === "stopping"}
              aria-label="Submit dictation"
              className={cn(
                promptFilledControlClass,
                dictation.status === "stopping" && "cursor-wait opacity-70",
              )}
              data-app-button
            >
              <Check className="icon-sm" strokeWidth={2.25} />
            </button>
          </HintTooltip>
        </>
      );
    }

    return (
      <>
        {!isConversationStarted ? renderModelSelector() : null}
        {renderMicButton()}
        {isGenerating ? (
          hasDraft || attachments.length > 0 ? (
            <HintTooltip content="Send (queue while generating)">
              <button
                type="button"
                onClick={handleSubmit}
                aria-label="Send queued message"
                className={promptFilledControlClass}
                data-app-button
              >
                <ArrowUp className="icon-md" strokeWidth={2} />
              </button>
            </HintTooltip>
          ) : (
            <HintTooltip content="Stop generating">
              <button
                type="button"
                onClick={onStopGeneration}
                aria-label="Stop generating"
                className={promptFilledControlClass}
                data-app-button
              >
                <Square className="size-3.5 fill-current" />
              </button>
            </HintTooltip>
          )
        ) : hasDraft || attachments.length > 0 ? (
          <HintTooltip content="Send">
            <button
              type="button"
              onClick={handleSubmit}
              aria-label="Send"
              className={promptFilledControlClass}
              data-app-button
            >
              <ArrowUp className="icon-md" strokeWidth={2} />
            </button>
          </HintTooltip>
        ) : (
          renderDisabledSendButton()
        )}
      </>
    );
  };

  useEffect(() => {
    if (isConversationStarted || hasDraft) return;
    const cycle = window.setInterval(() => {
      setHintVisible(false);
      window.setTimeout(() => {
        setHintIndex((index) => (index + 1) % WELCOME_HINTS.length);
        setHintVisible(true);
      }, 280);
    }, 3400);
    return () => window.clearInterval(cycle);
  }, [hasDraft, isConversationStarted]);

  const renderAddMenuButton = () => (
    <div className="relative flex shrink-0 items-center gap-1" data-prompt-add-anchor>
      <button
        ref={addMenuTriggerRef}
        type="button"
        aria-label="Add content"
        aria-expanded={isAddMenuOpen}
        disabled={isCapturingScreenshot}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => setAddMenuOpen(!isAddMenuOpen)}
        className={cn(
          addMenuTriggerClass,
          !isConversationStarted && "prompt-add-nav-match",
          isCapturingScreenshot && "opacity-50",
        )}
      >
        <Plus
          className={cn("shrink-0", isConversationStarted ? "icon-md" : "icon-xl")}
          strokeWidth={1.75}
        />
      </button>
      {!isConversationStarted ? (
        <div
          className="ml-0.5 inline-flex h-7 items-center rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.06]"
          role="tablist"
          aria-label="Composer mode"
        >
          {(["chat", "collabry"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={composerMode === mode}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setComposerMode(mode)}
              className={cn(
                "h-6 rounded-md px-2.5 text-[13px] font-medium leading-none transition-colors",
                composerMode === mode
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.08)] dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400",
              )}
            >
              {mode === "chat" ? "Chat" : "Collabry"}
            </button>
          ))}
        </div>
      ) : null}
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
        onOpenSkills={() =>
          openOverlayHash({ type: "settings", tab: "Skills" })
        }
      />
    </div>
  );

  const renderModelSelector = () =>
    showModelSelector && onChatModelChange ? (
      <PromptModelSelector
        selectedModel={chatModel}
        onSelectedModelChange={onChatModelChange}
        isFreePlan={isFreePlan}
        onUpgradeClick={
          onUpgradeClick ?? (() => openOverlayHash({ type: "pricing" }))
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

  const renderPromptBody = (placeholder: string, centerSlot?: ReactNode) => {
    return (
      <div
        className="prompt-body-grid w-full"
        data-prompt-layout={useCompactPromptLayout ? "compact" : "stacked"}
        data-prompt-expanded={promptIsExpanded || undefined}
      >
        <div data-prompt-add>{renderAddMenuButton()}</div>

        <div data-prompt-editor>
          {renderTextareaField(
            placeholder,
            useCompactPromptLayout ? "py-0" : "py-1",
          )}
          {/* Center slot (compose chip) sits under the editor when expanded */}
          {!useCompactPromptLayout && centerSlot ? (
            <div className="mt-1.5 flex items-center" data-prompt-center-inline>
              {centerSlot}
            </div>
          ) : null}
        </div>

        <div data-prompt-trailing>{renderTrailingActions()}</div>
      </div>
    );
  };

  const renderTextareaField = (placeholder: string, className?: string) => {
    const listeningEmpty =
      dictation.status === "listening" && !hasDraft && !readDraft().trim();
    const editorPlaceholder = listeningEmpty
      ? "Listening…"
      : !isConversationStarted && !hasDraft
        ? ""
        : placeholder;
    return (
      <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-0">
        {!isConversationStarted && !hasDraft && !listeningEmpty ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 truncate text-[14px] font-[430] leading-[21px] text-black/36 transition-opacity duration-300",
              hintVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {composerMode === "collabry" && hintIndex === 0
              ? "What should we work on together?"
              : WELCOME_HINTS[hintIndex]}
          </span>
        ) : null}
        {activeInlineMode ? (
          <PromptInlineModeChip mode={activeInlineMode} />
        ) : null}
        <textarea
          ref={assignTextareaRef}
          placeholder={editorPlaceholder}
          defaultValue={draftValueRef.current}
          onInput={(event) => {
            if (dictation.isListening && !applyingDictationRef.current) {
              const target = event.currentTarget;
              dictation.rebaseToCaret({
                start: target.selectionStart ?? target.value.length,
                end: target.selectionEnd ?? target.value.length,
              });
            }
            handleInput();
          }}
          onSelect={(event) => {
            if (!dictation.isListening || applyingDictationRef.current) return;
            const target = event.currentTarget;
            dictation.rebaseToCaret({
              start: target.selectionStart ?? target.value.length,
              end: target.selectionEnd ?? target.value.length,
            });
          }}
          onKeyDown={handleKeyDown}
          onPaste={scheduleResizeTextarea}
          onCompositionEnd={scheduleResizeTextarea}
          className={cn(
            "prompt-textarea block min-w-[3rem] min-h-0 flex-1 resize-none overflow-x-hidden border-0 bg-transparent text-[14px] font-[430] leading-[21px] text-[var(--ui-fg)] shadow-none outline-none ring-0 placeholder:text-black/36 focus:border-0 focus:outline-none focus:ring-0 sm:text-[14px] sm:leading-[21px]",
            showComposeControls ? "px-1 py-2" : "px-0 py-2",
            className,
          )}
          data-prompt-multiline={isMultiline || undefined}
          data-dictation={dictation.status !== "idle" ? dictation.status : undefined}
          rows={1}
        />
        <span className="sr-only" aria-live="polite">
          {dictationConnecting
            ? "Connecting dictation"
            : dictation.status === "listening"
              ? "Listening"
              : ""}
        </span>
      </div>
    );
  };

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
          )}
          data-prompt-wrapper
        >
          {showScrollToBottomButton &&
            onScrollToBottom &&
            isConversationStarted && (
              <HintTooltip content="Scroll to latest">
                <button
                  type="button"
                  onClick={onScrollToBottom}
                  className="absolute -top-10 right-2 z-20 flex size-7 items-center justify-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-field-bg)]/95 text-[var(--ui-fg-muted)] shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                >
                  <ArrowDown className="icon-md" />
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
            className="composer-stack w-full"
            data-composer-stack="solo"
            data-prompt-expanded={promptIsExpanded || undefined}
            data-add-menu-open={isAddMenuOpen || undefined}
          >
            <div
              className={cn(
                promptShellClass,
                isDraggingFiles && "ring-2 ring-[var(--brand-ring)]",
              )}
              ref={promptShellRef}
              data-prompt-shell
              data-prompt-expanded={promptIsExpanded || undefined}
              data-compose-mode={showComposeControls || undefined}
              data-drop-active={isDraggingFiles || undefined}
              data-add-menu-open={isAddMenuOpen || undefined}
            >
              {isDraggingFiles ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-[var(--ui-field-focus-border)] bg-[var(--brand-soft)] text-[13px] font-medium text-[var(--link)]">
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
                    className="flex items-center gap-1 overflow-hidden px-2.5 pt-2 pb-0"
                  >
                    {selectedQuickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => handleQuickActionRemove(action)}
                        className="inline-flex h-6 items-center gap-1 rounded-[7px] border border-[var(--ui-border)] bg-transparent px-2 text-[12px] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
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
                    className="overflow-hidden px-2 pt-2 sm:px-2.5"
                  >
                    <ComposerAttachmentStrip>
                      {attachments.map((attachment) => (
                        <AttachmentChip
                          key={attachment.id}
                          file={attachment}
                          onRemove={() => removeAttachment(attachment.id)}
                          onOpen={() => setPreviewAttachment(attachment)}
                        />
                      ))}
                    </ComposerAttachmentStrip>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {attachmentError ? (
                <p className="px-2.5 pt-1 text-[11px] text-[var(--settings-danger)] sm:px-3">
                  {attachmentError}
                </p>
              ) : null}

              {dictation.error ? (
                <p
                  className="px-2.5 pt-1 text-[11px] text-[var(--settings-danger)] sm:px-3"
                  role="alert"
                >
                  {dictation.error}
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

              {showComposeControls && composeMeta
                ? renderPromptBody(
                    composeMeta.placeholder,
                    <button
                      type="button"
                      aria-label={`Close ${composeMeta.label} mode`}
                      onMouseEnter={() => setComposeChipHovered(true)}
                      onMouseLeave={() => setComposeChipHovered(false)}
                      onClick={handleComposeActionRemove}
                      className="inline-flex h-6 items-center gap-1 rounded-[7px] border border-[var(--ui-field-focus-border)] bg-[var(--brand-soft)] px-2 text-[12px] font-medium text-[var(--link)] transition-colors hover:bg-[var(--ui-hover-wash)]"
                    >
                      {composeChipHovered ? (
                        <X className="icon-sm" />
                      ) : (
                        <composeMeta.icon className="icon-sm" />
                      )}
                      <span>{composeMeta.label}</span>
                    </button>,
                  )
                : renderPromptBody(placeholder)}
            </div>
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
            <div className="glass-chat-status-bar__trailing">
              {renderModelSelector()}
            </div>
          </div>
        </div>
      ) : null}

      <AttachmentPreviewHost
        file={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
