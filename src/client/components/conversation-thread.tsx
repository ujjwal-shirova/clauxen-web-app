"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  MoreHorizontal,
  RotateCcw,
  Search,
  Sparkles,
  SquarePen,
  Volume2,
} from "lucide-react";
import { AssistantContentRenderer } from "./assistant-content-renderer";
import { ThinkingBlock } from "./thinking-block";
import { AgentMessageContent } from "./agent/agent-message-content";
import { StreamingOrbCursor } from "./ui/streaming-orb-cursor";
import { AgentWorkingRow } from "./agent/agent-trace-view";
import { HintTooltip } from "./ui/hint-tooltip";
import type { Message } from "@/lib/types";
import { agentStepsVisuallyEqual } from "@/lib/agent-trace";
import { shouldUseAgentTraceLayout } from "@/components/agent/agent-message-content";
import { UserMessageInlineEditor } from "./user-message-inline-editor";
import { cn } from "@/lib/utils";
import { useMessageDetailLevel } from "@/hooks/use-message-visibility";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { useMessageEnterAnimation } from "@/hooks/use-message-enter-animation";
import { collectMessageSources } from "@/lib/chat-sources";
import { useIsMobile } from "@/hooks/use-mobile";
import { AttachmentChip } from "@/components/composer/attachment-chip";
import { AttachmentPreviewHost } from "@/components/composer/attachment-preview-host";
import { ComposerAttachmentStrip } from "@/components/composer/attachment-strip";
import type {
  ComposerAttachment,
  MessageAttachment,
} from "@/lib/composer-attachments";
import { messageUiKey } from "@/lib/message-ui-key";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { FollowUpPromptProvider } from "@/contexts/follow-up-prompt-context";
import { useAppPreferencesOptional } from "@/contexts/app-preferences-context";
import { stripFollowUpPromptTags } from "@/lib/follow-up-prompt";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import type { ConversationTurnGroup } from "@/lib/chat-turns";
import { hasCompletedAssistantOutput } from "@/lib/assistant-output-state";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";

const USER_MESSAGE_PREVIEW_LINES = 2;
const MESSAGE_ANCHOR_PREFIX = "chat-message-";

function messageAnchorId(messageId: string) {
  return `${MESSAGE_ANCHOR_PREFIX}${messageId}`;
}

interface ConversationThreadProps {
  messages: Message[];
  onSaveEditedMessage: (
    messageId: string,
    newContent: string,
    options?: { attachments?: ComposerAttachment[] },
  ) => Promise<void> | void;
  onRetryUserMessage: (messageId: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  onOpenSources?: (messageId?: string) => void;
  className?: string;
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>;
  /** Identifies the active chat; kept for API compatibility. */
  conversationKey?: string | null;
  /** Disables pointer events on turns while the user is flick-scrolling. */
  isFastScrolling?: boolean;
  /** True while the model is streaming a response. */
  isGenerating?: boolean;
  /** Send a suggested follow-up as a new user message. */
  onFollowUpSelect?: (prompt: string) => void;
}

const RetryIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 7.54619 3.67878 5.3677 5.49902 4H3C2.72386 4 2.5 3.77614 2.5 3.5C2.5 3.22386 2.72386 3 3 3H6.5C6.63261 3 6.75975 3.05272 6.85352 3.14648C6.92392 3.21689 6.97106 3.30611 6.99023 3.40234L7 3.5V7C7 7.27614 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.27614 6 7V4.87891C4.4782 6.06926 3.5 7.91979 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977Z" />
  </svg>
);

/** Share glyph matching the filled 20-grid set (the lucide node graph read odd). */
const ShareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M10 2.5c.133 0 .26.053.354.146l3 3a.5.5 0 0 1-.708.708L10.5 3.707V12.5a.5.5 0 0 1-1 0V3.707L7.354 6.354a.5.5 0 1 1-.708-.708l3-3A.5.5 0 0 1 10 2.5ZM4.5 8.5h2a.5.5 0 0 1 0 1H5a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10a.5.5 0 0 0-.5-.5h-1.5a.5.5 0 0 1 0-1H15A1.5 1.5 0 0 1 16.5 10v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16v-6A1.5 1.5 0 0 1 5 8.5h-.5Z" />
  </svg>
);

const CustomCopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12.5 3C13.3284 3 14 3.67157 14 4.5V6H15.5C16.3284 6 17 6.67157 17 7.5V15.5C17 16.3284 16.3284 17 15.5 17H7.5C6.67157 17 6 16.3284 6 15.5V14H4.5C3.67157 14 3 13.3284 3 12.5V4.5C3 3.67157 3.67157 3 4.5 3H12.5ZM14 12.5C14 13.3284 13.3284 14 12.5 14H7V15.5C7 15.7761 7.22386 16 7.5 16H15.5C15.7761 16 16 15.7761 16 15.5V7.5C16 7.22386 15.7761 7 15.5 7H14V12.5ZM4.5 4C4.22386 4 4 4.22386 4 4.5V12.5C4 12.7761 4.22386 13 4.5 13H12.5C12.7761 13 13 12.7761 13 12.5V4.5C13 4.22386 12.7761 4 12.5 4H4.5Z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.56055 2C11.1381 2.00009 12.3211 3.44332 12.0117 4.99023L11.6094 7H13.8438C15.5431 7 16.836 8.52594 16.5566 10.2021L15.876 14.2842C15.6148 15.8513 14.2586 17 12.6699 17H4.5C3.67157 17 3 16.3284 3 15.5V9.23828C3.00013 8.57996 3.4294 7.99838 4.05859 7.80469L5.19824 7.4541L5.33789 7.40723C6.02983 7.15302 6.59327 6.63008 6.89746 5.9541L8.41113 2.58984L8.48047 2.46094C8.66235 2.17643 8.97898 2.00002 9.32324 2H9.56055ZM7.80957 6.36523C7.39486 7.2867 6.62674 7.99897 5.68359 8.3457L5.49219 8.41016L4.35254 8.76074C4.14305 8.82539 4.00013 9.01904 4 9.23828V15.5C4 15.7761 4.22386 16 4.5 16H12.6699C13.7697 16 14.7087 15.2049 14.8896 14.1201L15.5703 10.0381C15.7481 8.97141 14.9251 8 13.8438 8H11C10.8503 8 10.7083 7.9331 10.6133 7.81738C10.5184 7.70164 10.4805 7.54912 10.5098 7.40234L11.0312 4.79395C11.2167 3.86589 10.507 3.00009 9.56055 3H9.32324L7.80957 6.36523Z" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12.6699 3C14.2586 3 15.6148 4.14871 15.876 5.71582L16.5566 9.79785C16.836 11.4741 15.5431 13 13.8438 13H11.6094L12.0117 15.0098C12.3211 16.5567 11.1381 17.9999 9.56055 18H9.32324C8.97898 18 8.66235 17.8236 8.48047 17.5391L8.41113 17.4102L6.89746 14.0459C6.59327 13.3699 6.02983 12.847 5.33789 12.5928L5.19824 12.5459L4.05859 12.1953C3.4294 12.0016 3.00013 11.42 3 10.7617V4.5C3 3.67157 3.67157 3 4.5 3H12.6699ZM4.5 4C4.22386 4 4 4.22386 4 4.5V10.7617C4.00013 10.981 4.14305 11.1746 4.35254 11.2393L5.49219 11.5898L5.68359 11.6543C6.62674 12.001 7.39486 12.7133 7.80957 13.6348L9.32324 17H9.56055C10.507 16.9999 11.2167 16.1341 11.0312 15.2061L10.5098 12.5977C10.4805 12.4509 10.5184 12.2984 10.6133 12.1826C10.7083 12.0669 10.8503 12 11 12H13.8438C14.9251 12 15.7481 11.0286 15.5703 9.96191L14.8896 5.87988C14.7087 4.79508 13.7697 4 12.6699 4H4.5Z" />
  </svg>
);

const InfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    viewBox="0 0 256 256"
    aria-hidden="true"
    className="shrink-0 mt-0.5"
  >
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
  </svg>
);

function BranchSwitcher({
  activeIndex,
  total,
  onPrev,
  onNext,
  disabled = false,
}: {
  activeIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const prevDisabled = disabled || activeIndex <= 0;
  const nextDisabled = disabled || activeIndex >= total - 1;
  return (
    <div
      data-branch-nav
      role="group"
      aria-label={`Version ${activeIndex + 1} of ${total}`}
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] px-0.5 py-0.5 text-[var(--ui-fg-muted)]"
    >
      <HintTooltip content="Previous version" side="bottom">
        <button
          type="button"
          aria-label="Previous version"
          onClick={onPrev}
          disabled={prevDisabled}
          className="no-hover-overlay flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </HintTooltip>
      <span
        aria-hidden="true"
        className="min-w-[38px] select-none text-center text-[12px] font-medium tabular-nums"
      >
        {activeIndex + 1} / {total}
      </span>
      <HintTooltip content="Next version" side="bottom">
        <button
          type="button"
          aria-label="Next version"
          onClick={onNext}
          disabled={nextDisabled}
          className="no-hover-overlay flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] disabled:pointer-events-none disabled:opacity-35"
        >
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </HintTooltip>
    </div>
  );
}

interface MessageRowProps {
  message: Message;
  editingMessageId: string | null;
  editValue?: string;
  copiedId: string | null;
  onEditValueChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    messageId: string,
    attachments?: ComposerAttachment[],
    contentOverride?: string,
  ) => void;
  onCopy: (id: string, text: string) => void;
  onRetryUserMessage: (messageId: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  onOpenSources?: (messageId?: string) => void;
  forcedDetailLevel?: MessageDetailLevel;
  moreMenuId?: string | null;
  onToggleMoreMenu?: (id: string, anchor?: DOMRect) => void;
  chatIsGenerating?: boolean;
}

const MessageRow = React.memo(
  function MessageRow({
    message,
    editingMessageId,
    editValue,
    copiedId,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
    onRetryUserMessage,
    onRetryAssistant,
    onSwitchBranch,
    onOpenSources,
    forcedDetailLevel,
    moreMenuId,
    onToggleMoreMenu,
    chatIsGenerating = false,
  }: MessageRowProps) {
    const branchVersions = message.branchVersions?.length ?? 1;
    const activeBranchIndex = message.activeBranchIndex ?? branchVersions - 1;
    const [previewAttachment, setPreviewAttachment] =
      React.useState<MessageAttachment | null>(null);
    const [userExpanded, setUserExpanded] = React.useState(false);
    const previewTextRef = React.useRef<HTMLParagraphElement>(null);
    const [previewOverflows, setPreviewOverflows] = React.useState(false);

    // The collapsed preview clamps to two lines. Only offer an explicit
    // Show more/less toggle when text actually overflows — measured live so
    // short messages never get a dead control. Length/newline fallbacks cover
    // long messages even if line-clamp metrics are unavailable.
    React.useLayoutEffect(() => {
      if (message.role !== "user") return;
      const el = previewTextRef.current;
      if (!el || !message.content.trim()) {
        setPreviewOverflows(false);
        return;
      }
      if (userExpanded) return;
      const measure = () => {
        setPreviewOverflows(el.scrollHeight > el.clientHeight + 2);
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }, [message.role, message.content, userExpanded]);

    const userNewlineCount =
      message.role === "user"
        ? (message.content.match(/\n/g) ?? []).length
        : 0;
    const showExpandToggle =
      message.role === "user" &&
      message.content.trim().length > 0 &&
      (userExpanded ||
        previewOverflows ||
        message.content.length > 320 ||
        userNewlineCount >= 2);
    // Structural markdown must keep one DOM tree. Downgrading a code block or
    // table to plain text off-screen changes its height and horizontal scroll,
    // which makes the chat jump when that message approaches the viewport.
    const hasStructuralMarkdown =
      message.role === "assistant" &&
      (/```|~~~|<table_title\b/i.test(message.content) ||
        /^\s*\|.+\|\s*$/m.test(message.content));
    const { ref: visibilityRef, detailLevel } = useMessageDetailLevel(
      message.role === "assistant" && !hasStructuralMarkdown,
      !!message.isStreaming,
    );
    const renderDetailLevel: MessageDetailLevel =
      forcedDetailLevel ?? (hasStructuralMarkdown ? "full" : detailLevel);
    const { shouldAnimate, markEntered } = useMessageEnterAnimation(
      messageUiKey(message),
      true,
    );
    const messageSources = React.useMemo(
      () =>
        message.role === "assistant" ? collectMessageSources(message) : [],
      [message],
    );
    const outputComplete = hasCompletedAssistantOutput(message);
    const liveStreaming = message.isStreaming === true && chatIsGenerating;
    const showWaitingOrb = shouldShowAssistantStreamingOrb({
      isStreaming: liveStreaming,
      answerStreaming: liveStreaming && message.content.trim().length > 0,
      chatIsGenerating,
    });

    return (
      <div
        ref={visibilityRef}
        className={cn(
          "group flex w-full max-w-full flex-col",
          shouldAnimate && "animate-in fade-in duration-200",
          message.role === "user"
            ? "w-full items-stretch"
            : "w-full items-stretch",
        )}
        onAnimationEnd={(event) => {
          if (event.currentTarget !== event.target) return;
          markEntered();
        }}
      >
        {message.role === "user" ? (
          <div
            id={messageAnchorId(message.id)}
            className="user-message-card relative flex w-full scroll-mt-20 flex-col font-sans"
          >
            {editingMessageId === message.id ? (
              <UserMessageInlineEditor
                messageId={message.id}
                initialAttachments={message.attachments}
                value={editValue ?? message.content}
                onValueChange={onEditValueChange}
                onCancel={onCancelEdit}
                onSubmit={async (content, attachments) => {
                  await onSaveEdit(message.id, attachments, content);
                }}
              />
            ) : (
              <div
                className="user-message-card__body user-msg-bubble no-hover-overlay relative ml-auto w-fit max-w-full text-left"
                data-user-expanded={userExpanded || undefined}
              >
                {message.attachments && message.attachments.length > 0 ? (
                  <div className="mb-2">
                    <ComposerAttachmentStrip>
                      {message.attachments.map((attachment) => (
                        <AttachmentChip
                          key={attachment.id}
                          file={attachment}
                          size="md"
                          onOpen={() => setPreviewAttachment(attachment)}
                        />
                      ))}
                    </ComposerAttachmentStrip>
                  </div>
                ) : null}
                {message.content.trim() ? (
                  <div className="user-message-card__preview relative">
                    <p
                      ref={previewTextRef}
                      className={cn(
                        "user-msg-text whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-[var(--ui-fg)]",
                        !userExpanded && "overflow-hidden",
                      )}
                      style={
                        userExpanded
                          ? undefined
                          : {
                              display: "-webkit-box",
                              WebkitLineClamp: USER_MESSAGE_PREVIEW_LINES,
                              WebkitBoxOrient: "vertical",
                            }
                      }
                    >
                      {message.content}
                    </p>
                    {!userExpanded && showExpandToggle ? (
                      <div
                        className="user-message-card__preview-fade"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                ) : null}
                {showExpandToggle ? (
                  <button
                    type="button"
                    onClick={() => setUserExpanded((prev) => !prev)}
                    aria-expanded={userExpanded}
                    className="user-message-card__toggle user-msg-toggle no-hover-overlay mt-1.5 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                  >
                    {userExpanded ? "Show less" : "Show more"}
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-150",
                        userExpanded && "rotate-180",
                      )}
                      strokeWidth={2}
                    />
                  </button>
                ) : null}
              </div>
            )}
            <AttachmentPreviewHost
              file={previewAttachment}
              onClose={() => setPreviewAttachment(null)}
            />
            {editingMessageId !== message.id ? (
              <div
                className="user-message-actions"
                data-has-branches={branchVersions > 1 || undefined}
              >
                {branchVersions > 1 ? (
                  <BranchSwitcher
                    activeIndex={activeBranchIndex}
                    total={branchVersions}
                    onPrev={() => onSwitchBranch(message.id, "prev")}
                    onNext={() => onSwitchBranch(message.id, "next")}
                    disabled={chatIsGenerating}
                  />
                ) : null}
                <div className="user-message-actions__buttons">
                  <HintTooltip
                    content="Retry with same input"
                    side="bottom"
                  >
                    <button
                      type="button"
                      aria-label="Retry with same input"
                      onClick={() => onRetryUserMessage(message.id)}
                      className="user-message-action-btn no-hover-overlay"
                    >
                      <RotateCcw
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Edit message" side="bottom">
                    <button
                      type="button"
                      aria-label="Edit message"
                      onClick={() => onStartEdit(message)}
                      className="user-message-action-btn no-hover-overlay"
                    >
                      <SquarePen
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Copy message" side="bottom">
                    <button
                      type="button"
                      aria-label="Copy user message"
                      onClick={() => onCopy(message.id, message.content)}
                      className="user-message-action-btn no-hover-overlay"
                    >
                      {copiedId === message.id ? (
                        <Check
                          className="size-4 text-[hsl(var(--success))]"
                          strokeWidth={2}
                        />
                      ) : (
                        <CustomCopyIcon />
                      )}
                    </button>
                  </HintTooltip>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              "assistant-message group w-full min-w-0 max-w-full",
              isAssistantGenerationError(message) &&
                !shouldUseAgentTraceLayout(message)
                ? "text-[var(--settings-danger)]"
                : "text-[var(--ui-fg-body)]",
            )}
          >
            {shouldUseAgentTraceLayout(message) ? (
              <div
                data-message-id={message.id}
                data-assistant-content="true"
                className="min-w-0 w-full"
              >
                <AgentMessageContent
                  message={message}
                  detailLevel={renderDetailLevel}
                  chatIsGenerating={chatIsGenerating}
                />
              </div>
            ) : isAssistantGenerationError(message) ? (
              <p
                data-message-id={message.id}
                data-assistant-error="true"
                className="min-w-0 text-[15px] font-medium leading-[1.55] text-[var(--settings-danger)]"
                role="alert"
              >
                {toUserFacingChatError(message.content)}
              </p>
            ) : (
              <>
                {(message.hasThinking ||
                  (message.thinkingContent?.trim().length ?? 0) > 0) && (
                  <ThinkingBlock
                    content={message.thinkingContent}
                    isStreaming={
                      !!message.isThinkingStreaming && chatIsGenerating
                    }
                    thinkingDurationSeconds={message.thinkingDurationSeconds}
                    thinkingStartedAtMs={message.thinkingStartedAtMs}
                    className="mb-4"
                  />
                )}
                {showWaitingOrb &&
                message.content.length === 0 &&
                !(
                  message.hasThinking ||
                  (message.thinkingContent?.trim().length ?? 0) > 0
                ) ? (
                  <AgentWorkingRow
                    startedAtMs={
                      message.agentTrace?.startedAtMs ?? message.createdAt
                    }
                  />
                ) : null}
                {showWaitingOrb &&
                message.content.length === 0 &&
                (message.hasThinking ||
                  (message.thinkingContent?.trim().length ?? 0) > 0) ? (
                  <div className="flex items-center py-1.5">
                    <StreamingOrbCursor />
                  </div>
                ) : null}
                {message.content.length > 0 ? (
                  <div
                    data-message-id={message.id}
                    data-assistant-content="true"
                    className="agent-answer-body min-w-0"
                  >
                    <AssistantContentRenderer
                      content={message.content}
                      messageId={message.id}
                      isStreaming={liveStreaming}
                      streamKey={messageUiKey(message)}
                      detailLevel={renderDetailLevel}
                      agentArtifacts={message.agentArtifacts}
                      {...({ sources: messageSources } as any)}
                    />
                  </div>
                ) : null}
              </>
            )}
            {outputComplete && !isAssistantGenerationError(message) ? (
              <>
                <div className="assistant-message-actions relative mt-2.5 flex flex-wrap items-center gap-1 overflow-anchor-none font-sans text-[var(--ui-fg-muted)]">
                  <HintTooltip content="Copy" side="bottom" align="start">
                    <button
                      type="button"
                      aria-label="Copy message"
                      onClick={() => onCopy(message.id, message.content)}
                      className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      {copiedId === message.id ? (
                        <Check
                          className="size-4 text-[hsl(var(--success))]"
                          strokeWidth={2}
                        />
                      ) : (
                        <CustomCopyIcon />
                      )}
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Positive feedback" side="bottom">
                    <button
                      type="button"
                      aria-label="Positive feedback"
                      className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <ThumbsUpIcon />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Negative feedback" side="bottom">
                    <button
                      type="button"
                      aria-label="Negative feedback"
                      className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <ThumbsDownIcon />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Retry" side="bottom">
                    <button
                      type="button"
                      aria-label="Retry"
                      onClick={() => onRetryAssistant(message.id)}
                      className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <RetryIcon />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Share" side="bottom">
                    <button
                      type="button"
                      aria-label="Share message"
                      onClick={async () => {
                        const text = message.content.trim();
                        if (!text) return;
                        if (typeof navigator.share === "function") {
                          try {
                            await navigator.share({ text });
                            return;
                          } catch {
                            // fall through to clipboard
                          }
                        }
                        await navigator.clipboard.writeText(text);
                      }}
                      className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <ShareIcon />
                    </button>
                  </HintTooltip>
                  <div className="relative" data-more-trigger>
                    <HintTooltip content="More" side="bottom">
                      <button
                        type="button"
                        aria-label="More actions"
                        aria-expanded={moreMenuId === message.id}
                        onClick={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          onToggleMoreMenu?.(message.id, rect);
                        }}
                        className="ui-icon-button text-[var(--ui-fg-muted)] transition-all hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                      >
                        <MoreHorizontal className="size-4" strokeWidth={1.75} />
                      </button>
                    </HintTooltip>
                  </div>
                  {messageSources.length > 0 ? (
                    <HintTooltip content="Sources" side="bottom">
                      <button
                        type="button"
                        onClick={() => onOpenSources?.(message.id)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2 text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:border-[var(--ui-field-focus-border)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                      >
                        <span className="flex -space-x-1">
                          {messageSources.slice(0, 3).map((source) => (
                            <img
                              key={source.id}
                              src={
                                source.favicon ||
                                `https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`
                              }
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-4 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)]"
                            />
                          ))}
                        </span>
                        <Search className="size-4" />
                        <span>Sources</span>
                      </button>
                    </HintTooltip>
                  ) : null}
                  {branchVersions > 1 ? (
                    <div className="ml-0.5">
                      <BranchSwitcher
                        activeIndex={activeBranchIndex}
                        total={branchVersions}
                        onPrev={() => onSwitchBranch(message.id, "prev")}
                        onNext={() => onSwitchBranch(message.id, "next")}
                        disabled={chatIsGenerating}
                      />
                    </div>
                  ) : null}

                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    const pm = prev.message;
    const nm = next.message;
    return (
      pm.id === nm.id &&
      pm.role === nm.role &&
      pm.content === nm.content &&
      pm.thinkingContent === nm.thinkingContent &&
      pm.hasThinking === nm.hasThinking &&
      pm.isStreaming === nm.isStreaming &&
      pm.isThinkingStreaming === nm.isThinkingStreaming &&
      pm.thinkingDurationSeconds === nm.thinkingDurationSeconds &&
      pm.agentMode === nm.agentMode &&
      pm.agentFrameComplete === nm.agentFrameComplete &&
      pm.agentTrace?.complete === nm.agentTrace?.complete &&
      pm.agentTrace?.startedAtMs === nm.agentTrace?.startedAtMs &&
      pm.agentTrace?.completedAtMs === nm.agentTrace?.completedAtMs &&
      agentStepsVisuallyEqual(pm.agentTrace?.steps, nm.agentTrace?.steps) &&
      pm.activeBranchIndex === nm.activeBranchIndex &&
      pm.branchVersions === nm.branchVersions &&
      pm.attachments === nm.attachments &&
      prev.editingMessageId === next.editingMessageId &&
      prev.editValue === next.editValue &&
      prev.copiedId === next.copiedId &&
      prev.forcedDetailLevel === next.forcedDetailLevel &&
      prev.moreMenuId === next.moreMenuId &&
      prev.chatIsGenerating === next.chatIsGenerating
    );
  },
);

interface ConversationTurnProps {
  userMessage: Message | null;
  assistantMessages: Message[];
  editingMessageId: string | null;
  editValue?: string;
  copiedId: string | null;
  onEditValueChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    messageId: string,
    attachments?: ComposerAttachment[],
    contentOverride?: string,
  ) => void;
  onCopy: (id: string, text: string) => void;
  onRetryUserMessage: (messageId: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  onOpenSources?: (messageId?: string) => void;
  moreMenuId?: string | null;
  onToggleMoreMenu?: (id: string, anchor?: DOMRect) => void;
  turnIndex: number;
  chatIsGenerating?: boolean;
}

const ConversationTurn = React.memo(
  function ConversationTurn({
    userMessage,
    assistantMessages,
    editingMessageId,
    editValue,
    copiedId,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
    onRetryUserMessage,
    onRetryAssistant,
    onSwitchBranch,
    onOpenSources,
    moreMenuId,
    onToggleMoreMenu,
    turnIndex,
    chatIsGenerating = false,
  }: ConversationTurnProps) {
    return (
      <div
        data-conversation-turn
        data-turn-index={turnIndex}
        data-turn-streaming={
          (chatIsGenerating &&
            assistantMessages.some((message) => message.isStreaming)) ||
          undefined
        }
        className="relative flex w-full flex-col gap-2.5"
        style={{ "--turn-index": turnIndex } as React.CSSProperties}
      >
        {userMessage && (
          <div className="w-full max-w-full shrink-0">
            <MessageRow
              message={userMessage}
              editingMessageId={editingMessageId}
              editValue={editValue}
              copiedId={copiedId}
              onEditValueChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onCopy={onCopy}
              onRetryUserMessage={onRetryUserMessage}
              onRetryAssistant={onRetryAssistant}
              onSwitchBranch={onSwitchBranch}
              onOpenSources={onOpenSources}
              moreMenuId={moreMenuId}
              onToggleMoreMenu={onToggleMoreMenu}
              chatIsGenerating={chatIsGenerating}
            />
          </div>
        )}
        {assistantMessages.map((msg) => (
          <MessageRow
            key={messageUiKey(msg)}
            message={msg}
            editingMessageId={editingMessageId}
            editValue={editingMessageId === msg.id ? editValue : undefined}
            copiedId={copiedId}
            onEditValueChange={onEditValueChange}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onCopy={onCopy}
            onRetryUserMessage={onRetryUserMessage}
            onRetryAssistant={onRetryAssistant}
            onSwitchBranch={onSwitchBranch}
            onOpenSources={onOpenSources}
            moreMenuId={moreMenuId}
            onToggleMoreMenu={onToggleMoreMenu}
            chatIsGenerating={chatIsGenerating}
          />
        ))}
      </div>
    );
  },
  (prev, next) => {
    const pu = prev.userMessage;
    const nu = next.userMessage;
    if (
      (pu === null) !== (nu === null) ||
      (pu &&
        nu &&
        (pu.id !== nu.id ||
          pu.content !== nu.content ||
          pu.activeBranchIndex !== nu.activeBranchIndex ||
          pu.branchVersions !== nu.branchVersions))
    ) {
      return false;
    }

    if (prev.assistantMessages.length !== next.assistantMessages.length) {
      return false;
    }

    for (let i = 0; i < prev.assistantMessages.length; i++) {
      const pa = prev.assistantMessages[i];
      const na = next.assistantMessages[i];
      if (
        pa.id !== na.id ||
        pa.content !== na.content ||
        pa.thinkingContent !== na.thinkingContent ||
        pa.isStreaming !== na.isStreaming ||
        pa.isThinkingStreaming !== na.isThinkingStreaming ||
        pa.thinkingDurationSeconds !== na.thinkingDurationSeconds ||
        pa.generationFailed !== na.generationFailed ||
        pa.agentMode !== na.agentMode ||
        pa.agentFrameComplete !== na.agentFrameComplete ||
        !agentStepsVisuallyEqual(pa.agentTrace?.steps, na.agentTrace?.steps) ||
        pa.activeBranchIndex !== na.activeBranchIndex ||
        pa.branchVersions !== na.branchVersions
      ) {
        return false;
      }
    }

    return (
      prev.editingMessageId === next.editingMessageId &&
      prev.editValue === next.editValue &&
      prev.copiedId === next.copiedId &&
      prev.onOpenSources === next.onOpenSources &&
      prev.moreMenuId === next.moreMenuId &&
      prev.turnIndex === next.turnIndex &&
      prev.chatIsGenerating === next.chatIsGenerating
    );
  },
);

export function ConversationThread({
  messages,
  onSaveEditedMessage,
  onRetryUserMessage,
  onRetryAssistant,
  onSwitchBranch,
  onOpenSources,
  className,
  isFastScrolling: isFastScrollingProp = false,
  isGenerating: isGeneratingProp = false,
  onFollowUpSelect,
}: ConversationThreadProps) {
  const preferences = useAppPreferencesOptional();
  const followUpsEnabled = preferences?.general.followUpSuggestions ?? true;
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );
  const [editValue, setEditValue] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [moreMenuId, setMoreMenuId] = React.useState<string | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = React.useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);
  const [selectionMenu, setSelectionMenu] = React.useState<null | {
    x: number;
    y: number;
    text: string;
    messageId: string;
  }>(null);
  const isMobile = useIsMobile();

  const handleCopy = React.useCallback(async (id: string, text: string) => {
    const markdown = stripFollowUpPromptTags(text).trim();
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard failures
    }
  }, []);

  const toggleMoreMenu = React.useCallback((id: string, anchor?: DOMRect) => {
    setMoreMenuId((current) => {
      if (current === id) {
        setMoreMenuAnchor(null);
        return null;
      }
      if (anchor) {
        const menuHeight = 148;
        const gap = 8;
        const spaceAbove = anchor.top;
        const placement =
          spaceAbove >= menuHeight + gap + 12 ? "above" : "below";
        setMoreMenuAnchor({
          left: Math.max(12, Math.min(anchor.left, window.innerWidth - 232)),
          top: placement === "above" ? anchor.top - gap : anchor.bottom + gap,
          placement,
        });
      } else {
        setMoreMenuAnchor(null);
      }
      return id;
    });
  }, []);

  const closeMoreMenu = React.useCallback(() => {
    setMoreMenuId(null);
    setMoreMenuAnchor(null);
  }, []);

  const moreMenuMessage = React.useMemo(
    () => messages.find((message) => message.id === moreMenuId) ?? null,
    [messages, moreMenuId],
  );

  React.useLayoutEffect(() => {
    if (!moreMenuId) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("[data-more-menu]") &&
        !target.closest("[data-more-trigger]")
      ) {
        closeMoreMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMoreMenu();
    };
    const onScroll = () => closeMoreMenu();
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [moreMenuId, closeMoreMenu]);

  // Desktop-only text selection floating menu for assistant answers.
  // Debounced so the bar appears after a short intentional highlight, not
  // on every selectionchange flicker.
  React.useEffect(() => {
    if (isMobile) return;

    let raf = 0;
    let showTimer = 0;
    const SHOW_DELAY_MS = 320;

    const hideMenu = () => {
      window.clearTimeout(showTimer);
      showTimer = 0;
      setSelectionMenu(null);
    };

    const onSelect = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
          hideMenu();
          return;
        }
        const text = sel.toString().replace(/\u00a0/g, " ");
        if (!text.trim()) {
          hideMenu();
          return;
        }

        const range = sel.getRangeAt(0);
        let node: Node | null = range.commonAncestorContainer;
        let messageId: string | null = null;
        while (node && node !== document.body) {
          const el = node instanceof Element ? node : node.parentElement;
          if (el) {
            const mid = el.getAttribute("data-message-id");
            const isAssistantArea =
              el.getAttribute("data-assistant-content") === "true" ||
              !!el.closest?.("[data-assistant-content='true']");
            if (mid && isAssistantArea) {
              messageId = mid;
              break;
            }
          }
          node = node.parentNode;
        }
        if (!messageId) {
          hideMenu();
          return;
        }

        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          hideMenu();
          return;
        }

        const barApproxWidth = 248;
        const x = Math.max(
          12,
          Math.min(
            rect.left + rect.width / 2 - barApproxWidth / 2,
            window.innerWidth - barApproxWidth - 12,
          ),
        );
        const y = Math.max(12, rect.top - 44);
        const next = { x, y, text: text.trim(), messageId };

        window.clearTimeout(showTimer);
        showTimer = window.setTimeout(() => {
          showTimer = 0;
          // Re-check selection is still valid after the delay.
          const still = window.getSelection();
          if (!still || still.isCollapsed) return;
          if (
            still
              .toString()
              .replace(/\u00a0/g, " ")
              .trim() !== next.text
          ) {
            return;
          }
          setSelectionMenu(next);
        }, SHOW_DELAY_MS);
      });
    };

    document.addEventListener("selectionchange", onSelect);
    document.addEventListener("scroll", hideMenu, true);
    window.addEventListener("resize", hideMenu);

    return () => {
      document.removeEventListener("selectionchange", onSelect);
      document.removeEventListener("scroll", hideMenu, true);
      window.removeEventListener("resize", hideMenu);
      cancelAnimationFrame(raf);
      window.clearTimeout(showTimer);
    };
  }, [isMobile]);

  const handleStartEdit = React.useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setEditValue(message.content);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingMessageId(null);
    setEditValue("");
  }, []);

  // The inline editor only closes via Cancel, Escape, or Save. Dismissing on
  // outside pointer-down silently discarded in-progress edits — a stray click
  // while re-reading the thread must never lose the draft.

  const handleSaveEdit = React.useCallback(
    async (
      messageId: string,
      attachments?: ComposerAttachment[],
      contentOverride?: string,
    ) => {
      const trimmed = (contentOverride ?? editValue).trim();
      if (!trimmed && !(attachments && attachments.length > 0)) return;
      // Close the editor synchronously so the forked branch (edited prompt +
      // fresh streaming placeholder) paints immediately. The branch fork
      // truncates the previous answer in the same update; awaiting the full
      // stream before closing would keep the editor over the new branch.
      setEditingMessageId(null);
      setEditValue("");
      await onSaveEditedMessage(messageId, trimmed, { attachments });
    },
    [editValue, onSaveEditedMessage],
  );

  const groups = React.useMemo(
    () => groupMessagesIntoTurns(messages),
    [messages],
  );

  const listRef = React.useRef<HTMLDivElement>(null);

  const turnProps = {
    editingMessageId,
    copiedId,
    onEditValueChange: setEditValue,
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onSaveEdit: handleSaveEdit,
    onCopy: handleCopy,
    onRetryUserMessage,
    onRetryAssistant,
    onSwitchBranch,
    onOpenSources,
    moreMenuId,
    onToggleMoreMenu: toggleMoreMenu,
    chatIsGenerating: isGeneratingProp,
  };

  return (
    <FollowUpPromptProvider
      enabled={followUpsEnabled}
      onSelect={onFollowUpSelect}
    >
      <div
        ref={listRef}
        className={cn(
          "flex w-full min-w-0 max-w-full flex-col gap-5 px-0 pb-5 pt-[calc(var(--chat-header-height,44px)+12px)] sm:gap-8 sm:px-0 sm:pb-8 sm:pt-10",
          className,
        )}
        data-virtual-scroll
        data-fast-scrolling={isFastScrollingProp || undefined}
      >
        {/* Full-thread hydrate — no scroll-up pagination affordance. */}
        <div className="h-px w-full shrink-0" aria-hidden />

        {groups.map((group, index) => (
          <ConversationTurn
            key={
              group.userMessage?.turnId ??
              (group.userMessage
                ? messageUiKey(group.userMessage)
                : (group.assistantMessages[0]?.turnId ?? `turn-${index}`))
            }
            turnIndex={index}
            userMessage={group.userMessage}
            assistantMessages={group.assistantMessages}
            editValue={
              editingMessageId === group.userMessage?.id ? editValue : undefined
            }
            {...turnProps}
          />
        ))}
        <div
          className="chat-thread-scroll-anchor h-px w-full shrink-0"
          aria-hidden
        />

        {selectionMenu &&
          !isMobile &&
          createPortal(
            <div
              className="fixed z-[95] flex items-center overflow-hidden rounded-full border border-[var(--popup-border)] bg-[var(--popup-bg)] shadow-[var(--popup-shadow)] animate-in fade-in zoom-in-95 duration-150"
              style={{
                left: `${selectionMenu.x}px`,
                top: `${selectionMenu.y}px`,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-[var(--ui-fg)] transition hover:bg-[var(--ui-hover-wash)]"
                onClick={() => {
                  navigator.clipboard
                    .writeText(selectionMenu.text)
                    .catch(() => {});
                  setSelectionMenu(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask Clauxen
              </button>
              <span className="h-5 w-px bg-[var(--ui-border)]" aria-hidden />
              <button
                type="button"
                className="px-3 py-1.5 text-[12.5px] font-medium text-[var(--ui-fg-muted)] transition hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                onClick={() => {
                  navigator.clipboard
                    .writeText(selectionMenu.text)
                    .catch(() => {});
                  setSelectionMenu(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                Start writing
              </button>
            </div>,
            document.body,
          )}

        {moreMenuId &&
          moreMenuAnchor &&
          moreMenuMessage &&
          createPortal(
            <div
              data-more-menu
              className="fixed z-[95] w-[220px] rounded-[14px] border border-[var(--popup-border)] bg-[var(--popup-bg)] p-1 text-[13px] text-[var(--ui-fg)] shadow-[var(--popup-shadow)]"
              style={{
                left: `${moreMenuAnchor.left}px`,
                top: `${moreMenuAnchor.top}px`,
                transform:
                  moreMenuAnchor.placement === "above"
                    ? "translateY(-100%)"
                    : undefined,
              }}
            >
              <div className="px-3 py-1.5 text-[11px] text-[var(--ui-fg-muted)]">
                {moreMenuMessage.createdAt
                  ? new Date(moreMenuMessage.createdAt).toLocaleString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )
                  : "Just now"}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                onClick={() => {
                  closeMoreMenu();
                  const branchText = `Continuing from: ${moreMenuMessage.content.slice(0, 120)}${moreMenuMessage.content.length > 120 ? "…" : ""}`;
                  navigator.clipboard.writeText(branchText).catch(() => {});
                }}
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>Branch in new chat</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                onClick={() => {
                  closeMoreMenu();
                  try {
                    const utter = new SpeechSynthesisUtterance(
                      moreMenuMessage.content
                        .replace(/\s+/g, " ")
                        .slice(0, 1200),
                    );
                    window.speechSynthesis?.speak(utter);
                  } catch {
                    // ignore TTS failures
                  }
                }}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Read aloud</span>
              </button>
            </div>,
            document.body,
          )}
      </div>
    </FollowUpPromptProvider>
  );
}
