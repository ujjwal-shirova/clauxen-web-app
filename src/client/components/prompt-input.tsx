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
  ChevronDown,
  Folder,
  FolderKanban,
  LoaderCircle,
  Mic,
  Plus,
  SlidersHorizontal,
  Square,
  Star,
  Telescope,
  X,
} from "@/components/ui/bootstrap-icon";
import { cn } from "@/lib/utils";
import { useOptionalAuthGate } from "@/contexts/auth-gate-context";
import {
  captureDisplayScreenshot,
  ScreenshotCaptureError,
} from "@/lib/capture-display-screenshot";
import {
  PromptAddMenuPanel,
  type PromptComposeAction,
  type WebSearchMode,
} from "./prompt-add-menu";
import {
  PromptInlineModeChip,
  type PromptInlineMode,
} from "./prompt-inline-mode-chip";
import { HintTooltip } from "./ui/hint-tooltip";
import { ShortcutHint } from "./ui/kbd";
import { isReservedNavKeyEvent } from "@/lib/keyboard-navigation";
import { KS_EVENTS } from "@/lib/keyboard-shortcut-events";
import { useIsClient } from "@/hooks/use-is-client";
import { MessageQueuePanel } from "./message-queue-panel";
import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/chat-models";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import { PromptModelSelector } from "./prompt-model-selector";
import { useActiveChatId, type QueuedChatMessage } from "@/stores/chat-store";
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
import {
  formatDictationRemaining,
  useStreamingDictation,
} from "@/features/dictation/use-streaming-dictation";
import type { CaretRange } from "@/features/dictation/transcript";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateProjectDialog } from "./projects/projects-view";
import {
  listProjects,
  updateProject,
  type ProjectSummary,
} from "@/lib/api/projects";

function openOverlayHash(overlay: Parameters<typeof overlayToHash>[0]) {
  const hash = overlayToHash(overlay);
  if (typeof window === "undefined") return;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

type ThinkingMode = "on" | "off";

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
  /** Tag uploads with a project without waiting to send. */
  projectId?: string | null;
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

const promptFilledControlClass =
  "no-hover-overlay prompt-control-filled shrink-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-app-button";

/** Fallback single-line height when measurement is not ready yet. */
const COLLAPSED_TEXTAREA_HEIGHT_PX = 20;
const MAX_PROMPT_LINES = 7;
const PROMPT_NOTIFY_DEBOUNCE_MS = 120;

/** Measure content height on a mirror so the live field never collapses. */
function measureTextareaScrollHeight(textarea: HTMLTextAreaElement): number {
  const mirror = document.createElement("textarea");
  const style = window.getComputedStyle(textarea);
  mirror.setAttribute("aria-hidden", "true");
  mirror.tabIndex = -1;
  mirror.value = textarea.value;
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.height = "0";
  mirror.style.minHeight = "0";
  mirror.style.maxHeight = "none";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.whiteSpace = style.whiteSpace;
  document.body.appendChild(mirror);
  const measured = mirror.scrollHeight;
  mirror.remove();
  return measured;
}

function ProjectSelectorPopover({
  projectId,
  onProjectChange,
  canOpen,
}: {
  projectId?: string | null;
  onProjectChange?: (projectId: string | null) => void;
  canOpen?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedProjectId(projectId ?? null);
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listProjects()
      .then((res) => {
        if (res?.projects) {
          setProjects(res.projects);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleTogglePin = async (e: React.MouseEvent, project: ProjectSummary) => {
    e.stopPropagation();
    e.preventDefault();
    const nextPinned = !project.pinned;
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, pinned: nextPinned } : p)),
    );
    try {
      await updateProject(project.id, { pinned: nextPinned });
    } catch {
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, pinned: !nextPinned } : p)),
      );
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next && canOpen && !canOpen()) return;
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Select project"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-zinc-500 transition-colors outline-none hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100"
          >
            <Folder className="size-3.5 shrink-0" />
            <span className="max-w-[140px] truncate">
              {activeProject ? activeProject.name : "Select project"}
            </span>
            <ChevronDown className="size-3 shrink-0 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={8}
          className="z-[120] w-[270px] rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl text-[13px]"
        >
          {/* Top Search bar */}
          <div className="relative flex items-center h-8 w-full rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-2.5 mb-1 border border-zinc-200/60 dark:border-zinc-700/60 focus-within:border-zinc-300 dark:focus-within:border-zinc-600 focus-within:bg-white dark:focus-within:bg-zinc-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or create a project"
              className="w-full bg-transparent text-[12.5px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 outline-none"
            />
            <SlidersHorizontal className="size-3.5 text-zinc-400 shrink-0 ml-1.5" />
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

          {/* Project list */}
          <div className="max-h-[220px] overflow-y-auto space-y-0.5 py-0.5">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      const nextId = isSelected ? null : proj.id;
                      setSelectedProjectId(nextId);
                      onProjectChange?.(nextId);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-[13px] transition-colors group cursor-pointer",
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 font-medium"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderKanban
                        className="size-4 shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={proj.pinned ? "Unstar project" : "Star project"}
                      onClick={(e) => void handleTogglePin(e, proj)}
                      className="p-1 rounded hover:bg-black/[0.05] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      <Star
                        className={cn(
                          "size-3.5",
                          proj.pinned && "fill-amber-400 text-amber-500",
                        )}
                        strokeWidth={1.8}
                      />
                    </button>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[12px] text-zinc-400">
                {loading ? "Loading..." : "No projects found"}
              </div>
            )}
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

          {/* New project action */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreateProjectOpen(true);
            }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <Plus className="size-3.5 text-zinc-500" strokeWidth={2} />
            <span>New project</span>
          </button>
        </PopoverContent>
      </Popover>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />
    </>
  );
}

function PermissionModePopover({
  canOpen,
}: {
  canOpen?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [permissionMode, setPermissionMode] = useState<"manual" | "auto">("manual");

  useEffect(() => {
    settingsApi.getSettings()
      .then((res) => {
        if (res?.general?.toolMode === "auto") {
          setPermissionMode("auto");
        } else {
          setPermissionMode("manual");
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectMode = (mode: "manual" | "auto") => {
    setPermissionMode(mode);
    setOpen(false);
    void settingsApi.updateSettings({
      general: { toolMode: mode },
    }).catch(() => {});
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next && canOpen && !canOpen()) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Permission mode"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors outline-none cursor-pointer"
        >
          {permissionMode === "manual" ? "Manual" : "Auto"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="z-[120] w-[275px] rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-xl text-[13px]"
      >
        <div className="px-1.5 pt-1 pb-1.5 text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
          Permission mode
        </div>

        <div className="space-y-1">
          {/* Manual */}
          <button
            type="button"
            onClick={() => handleSelectMode("manual")}
            className="flex items-start justify-between w-full p-2 rounded-lg text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group cursor-pointer"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                Manual
              </div>
              <div className="text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400 mt-0.5">
                Clauxen asks before using new tools or opening new sites.
              </div>
            </div>
            {permissionMode === "manual" ? (
              <Check className="size-4 text-blue-500 shrink-0 mt-0.5" strokeWidth={2.5} />
            ) : null}
          </button>

          {/* Auto */}
          <button
            type="button"
            onClick={() => handleSelectMode("auto")}
            className="flex items-start justify-between w-full p-2 rounded-lg text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group cursor-pointer"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                Auto
              </div>
              <div className="text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400 mt-0.5">
                Clauxen runs on its own and pauses to ask if anything looks unsafe.
              </div>
            </div>
            {permissionMode === "auto" ? (
              <Check className="size-4 text-blue-500 shrink-0 mt-0.5" strokeWidth={2.5} />
            ) : null}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReasoningEffortSelector({
  effort = "high",
  onEffortChange,
}: {
  effort?: HomerReasoningEffort;
  onEffortChange?: (effort: HomerReasoningEffort) => void;
}) {
  const [selectedEffort, setSelectedEffort] = useState<string>("Medium");

  const options = ["Low", "Medium", "High", "Max"] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Reasoning effort"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors outline-none cursor-pointer"
        >
          <span>{selectedEffort}</span>
          <ChevronDown className="size-3 shrink-0 text-zinc-400" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="z-[120] min-w-[140px] rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-lg text-[13px]"
      >
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Reasoning effort
        </div>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => {
              setSelectedEffort(opt);
              if (onEffortChange) {
                onEffortChange(opt === "Max" ? "max" : "high");
              }
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <span>{opt}</span>
            {selectedEffort === opt ? (
              <Check className="size-3.5 text-blue-500" strokeWidth={2.2} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  placeholder = "Ask anything, or task an agent...",
  allowAttachments = true,
  composerVariant = "default",
  projectId = null,
}: PromptInputProps) {
  const activeChatId = useActiveChatId();
  /** Uncontrolled input — draft lives in the DOM ref, not React state (zero parent re-renders). */
  const [hasDraft, setHasDraft] = useState(false);
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
  const applyDictationDraft = useCallback(
    (value: string, caret: CaretRange) => {
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
    },
    [],
  );
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
      // Keys reserved for app navigation (j/k/g//?) never type into the
      // composer — the global keyboard engine owns them.
      if (isReservedNavKeyEvent(e)) return;

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

  // "/" (or the user's binding) → jump straight to the message box.
  useEffect(() => {
    const focusComposer = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus({ preventScroll: true });
      textarea.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener(KS_EVENTS.focusComposer, focusComposer);
    return () =>
      window.removeEventListener(KS_EVENTS.focusComposer, focusComposer);
  }, []);

  const dismissComposerFocus = useCallback(() => {
    textareaRef.current?.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }, []);

  const authGate = useOptionalAuthGate();
  /** Guest preview: protected composer actions open the sign-in dialog. */
  const requireAuthGate = useCallback(
    () => (authGate ? authGate.requireAuth() : true),
    [authGate],
  );

  const handleSubmit = () => {
    if (!requireAuthGate()) return;
    const value = readDraft().trim();
    // Allow send while generating — active chat queues; other chats start a stream.
    if (value || attachments.length > 0) {
      const payload = attachments.map((item) => ({ ...item }));
      onSendMessage(
        activeInlineMode === "deep-research"
          ? `[Deep research]\n${value}`
          : value,
        { attachments: payload },
      );
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
      const skipUpload = !allowAttachments || composerVariant === "incognito";
      addAttachment({
        ...attachment,
        uploadStatus: skipUpload
          ? (attachment.uploadStatus ?? "local")
          : "uploading",
      });
      beginComposerAttachmentWork(attachment, {
        chatId: activeChatId,
        projectId,
        skipUpload,
        onUpdate: patchAttachment,
      });
    },
    [
      activeChatId,
      projectId,
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
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Backspace" && activeInlineMode) {
      const textarea = textareaRef.current;
      if (textarea) {
        const atStart =
          textarea.selectionStart === 0 && textarea.selectionEnd === 0;
        const empty = !readDraft().trim();
        if (atStart && (empty || activeInlineMode === "deep-research")) {
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
    "relative w-full max-w-full bg-white transition-[min-height,border-color,background-color,box-shadow] duration-200 ease-out rounded-[26px] border border-black/[0.08] shadow-[0_1px_2px_rgba(20,21,26,0.03),0_12px_32px_-24px_rgba(20,21,26,0.18)] focus-within:border-black/[0.14] focus-within:shadow-[0_1px_2px_rgba(20,21,26,0.04),0_16px_40px_-24px_rgba(20,21,26,0.22)] dark:bg-zinc-900 dark:border-white/[0.1] dark:focus-within:border-white/[0.16]",
    showComposeControls && "min-h-[40px]",
    composerVariant === "incognito" &&
      "border border-dashed border-zinc-300/90 shadow-none dark:border-zinc-600/80",
  );

  const renderMicButton = () => (
    <HintTooltip content={dictationConnecting ? "Connecting…" : "Dictate"}>
      <button
        type="button"
        onClick={() => {
          if (dictationConnecting) return;
          if (!requireAuthGate()) return;
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
    <ShortcutHint
      label="Send message"
      keys={["Enter"]}
      extraKeys={["meta", "Enter"]}
    >
      <button
        type="button"
        disabled
        aria-label="Send"
        className={cn(promptFilledControlClass, "cursor-not-allowed")}
      >
        <ArrowUp className="icon-sm" strokeWidth={2} />
      </button>
    </ShortcutHint>
  );

  const renderTrailingActions = (sendOnly = false) => {
    if (showDictationActions) {
      return (
        <>
          {dictation.remainingSeconds !== null ? (
            <span
              className={cn(
                "dictation-countdown",
                dictation.remainingSeconds <= 30 && "dictation-countdown--low",
              )}
              aria-label={`${dictation.remainingSeconds} seconds of dictation left`}
            >
              {formatDictationRemaining(dictation.remainingSeconds)}
            </span>
          ) : null}
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
        {!sendOnly && !isConversationStarted ? renderModelSelector() : null}
        {!sendOnly ? renderMicButton() : null}
        {isGenerating ? (
          hasDraft || attachments.length > 0 ? (
            <ShortcutHint
              label="Send (queue while generating)"
              keys={["Enter"]}
              extraKeys={["meta", "Enter"]}
            >
              <button
                type="button"
                onClick={handleSubmit}
                aria-label="Send queued message"
                className={promptFilledControlClass}
                data-app-button
              >
                <ArrowUp className="icon-md" strokeWidth={2} />
              </button>
            </ShortcutHint>
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
          <ShortcutHint
            label="Send message"
            keys={["Enter"]}
            extraKeys={["meta", "Enter"]}
          >
            <button
              type="button"
              onClick={handleSubmit}
              aria-label="Send"
              className={promptFilledControlClass}
              data-app-button
            >
              <ArrowUp className="icon-md" strokeWidth={2} />
            </button>
          </ShortcutHint>
        ) : (
          renderDisabledSendButton()
        )}
      </>
    );
  };

  const renderAddMenuButton = () => (
    <div
      className="relative flex shrink-0 items-center gap-1"
      data-prompt-add-anchor
    >
      <ShortcutHint
        label="Attach files"
        keys={["meta", "U"]}
        side="top"
        align="start"
      >
        <button
          ref={addMenuTriggerRef}
          type="button"
          aria-label={isAddMenuOpen ? "Close add menu" : "Add content"}
          aria-expanded={isAddMenuOpen}
          aria-haspopup="menu"
          disabled={isCapturingScreenshot}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            setAddMenuOpen(!isAddMenuOpen);
          }}
          className={cn(
            addMenuTriggerClass,
            !isConversationStarted && "prompt-add-nav-match",
            isAddMenuOpen && "is-open",
            isCapturingScreenshot && "opacity-50",
          )}
        >
          <Plus
            className={cn(
              "shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isAddMenuOpen && "rotate-45",
              isConversationStarted ? "icon-md" : "icon-xl",
            )}
            strokeWidth={1.75}
          />
        </button>
      </ShortcutHint>
    </div>
  );

  const renderModelSelector = () =>
    showModelSelector && onChatModelChange ? (
      <PromptModelSelector
        selectedModel={chatModel}
        onSelectedModelChange={onChatModelChange}
        isFreePlan={isFreePlan}
        thinkingEnabled={thinkingMode === "on"}
        onThinkingEnabledChange={(enabled) =>
          handleThinkingModeChange(enabled ? "on" : "off")
        }
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
    if (!isConversationStarted) {
      return (
        <div className="prompt-welcome" data-prompt-welcome="true">
          <div className="prompt-welcome__input">
            {renderTextareaField(placeholder, "py-0")}
          </div>
          <div className="prompt-welcome__bar">
            {renderAddMenuButton()}
            <div className="min-w-0 flex-1" />
            <div className="flex items-center gap-1 sm:gap-1.5">
              {renderModelSelector()}
              {renderMicButton()}
              {renderTrailingActions(true)}
            </div>
          </div>
          {centerSlot}
        </div>
      );
    }
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
    const editorPlaceholder = activeInlineMode
      ? ""
      : listeningEmpty
        ? "Listening…"
        : placeholder;
    return (
      <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-0">
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
            "prompt-textarea block min-w-[3rem] min-h-0 flex-1 resize-none overflow-x-hidden border-0 bg-transparent text-[15.5px] font-normal leading-[24px] text-zinc-900 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-[15.5px] sm:leading-[24px] dark:text-zinc-100 dark:placeholder:text-zinc-500",
            showComposeControls ? "px-1 py-2" : "px-0 py-2",
            className,
          )}
          data-prompt-multiline={isMultiline || undefined}
          data-dictation={
            dictation.status !== "idle" ? dictation.status : undefined
          }
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
              <ShortcutHint label="Scroll to latest" keys={["End"]}>
                <button
                  type="button"
                  onClick={onScrollToBottom}
                  className="absolute -top-10 right-2 z-20 flex size-7 items-center justify-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-field-bg)]/95 text-[var(--ui-fg-muted)] shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                >
                  <ArrowDown className="icon-md" />
                </button>
              </ShortcutHint>
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
            className="composer-stack relative w-full"
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
              ) : dictation.notice ? (
                <p
                  className="px-2.5 pt-1 text-[11px] text-[var(--ui-fg-muted)] sm:px-3"
                  role="status"
                >
                  {dictation.notice}
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
            <AnimatePresence initial={false}>
              {isAddMenuOpen ? (
                <PromptAddMenuPanel
                  panelRef={addMenuPanelRef}
                  placement={isConversationStarted ? "above" : "below"}
                  onClose={() => {
                    setAddMenuOpen(false);
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                  onAddFiles={
                    allowAttachments
                      ? () => {
                          if (!requireAuthGate()) return;
                          openFilePicker();
                        }
                      : undefined
                  }
                  onDeepResearch={() => {
                    if (!requireAuthGate()) return;
                    setActiveInlineMode("deep-research");
                    setAddMenuOpen(false);
                    requestAnimationFrame(() => {
                      textareaRef.current?.focus({ preventScroll: true });
                      scheduleResizeTextarea();
                    });
                  }}
                  webSearchMode={webSearchMode}
                  onWebSearchModeChange={handleWebSearchModeChange}
                />
              ) : null}
            </AnimatePresence>
          </div>
          {!isConversationStarted ? (
            <div data-prompt-toolbar="true" className="prompt-welcome-toolbar">
              <div className="flex min-w-0 items-center gap-1">
                <ProjectSelectorPopover
                  projectId={projectId}
                  canOpen={requireAuthGate}
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <ReasoningEffortSelector
                  effort={homerReasoningEffort}
                  onEffortChange={onHomerReasoningEffortChange}
                />
                <PermissionModePopover canOpen={requireAuthGate} />
              </div>
            </div>
          ) : null}
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
