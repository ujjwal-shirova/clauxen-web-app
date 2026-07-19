"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  Check,
  GitBranch,
  MoreHorizontal,
  Search,
  Share2,
  Sparkles,
  Volume2,
} from "lucide-react";
import { AssistantContentRenderer } from "./assistant-content-renderer";
import { ThinkingBlock } from "./thinking-block";
import { AgentMessageContent } from "./agent/agent-message-content";
import { StreamingOrbCursor } from "./ui/streaming-orb-cursor";
import { HintTooltip } from "./ui/hint-tooltip";
import type { Message } from "@/frontend/lib/types";
import { agentSegmentsVisuallyEqual } from "@/frontend/lib/agent-segments";
import { agentFramesVisuallyEqual, shouldUseAgentMessageLayout } from "@/frontend/lib/agent-frames";
import { UserMessageInlineEditor } from "./user-message-inline-editor";
import { cn } from "@/frontend/lib/utils";
import { useMessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { useMessageEnterAnimation } from "@/frontend/hooks/use-message-enter-animation";
import { collectMessageSources } from "@/frontend/lib/chat-sources";
import { formatDemoMessagesRemainingLabel } from "@/lib/demo-razorpay-quota";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { AttachmentChip } from "@/frontend/components/composer/attachment-chip";
import { AttachmentImageLightbox } from "@/frontend/components/composer/attachment-image-lightbox";
import { AttachmentDocumentPreview } from "@/frontend/components/composer/attachment-document-preview";
import type {
  ComposerAttachment,
  MessageAttachment,
} from "@/frontend/lib/composer-attachments";
import { messageUiKey } from "@/frontend/lib/message-ui-key";
import { FollowUpPromptProvider } from "@/frontend/contexts/follow-up-prompt-context";
import { useAppPreferencesOptional } from "@/frontend/contexts/app-preferences-context";
import { stripFollowUpPromptTags } from "@/lib/follow-up-prompt";
import { dedupeChatMessages } from "@/frontend/lib/dedupe-chat-messages";

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
  /** Resets sticky state when switching chats. */
  conversationKey?: string | null;
  /** Skip heavy sticky work while the user is flick-scrolling. */
  isFastScrolling?: boolean;
  /** Throttle sticky observers while the model is streaming. */
  isGenerating?: boolean;
  /** Send a suggested follow-up as a new user message. */
  onFollowUpSelect?: (prompt: string) => void;
}

type ConversationTurnGroup = {
  userMessage: Message | null;
  assistantMessages: Message[];
};

function groupMessagesIntoTurns(messages: Message[]): ConversationTurnGroup[] {
  const groups: ConversationTurnGroup[] = [];
  const deduped = dedupeChatMessages(messages);
  deduped.forEach((msg) => {
    if (msg.role === "user") {
      groups.push({ userMessage: msg, assistantMessages: [] });
    } else if (groups.length === 0) {
      groups.push({ userMessage: null, assistantMessages: [msg] });
    } else {
      groups[groups.length - 1].assistantMessages.push(msg);
    }
  });
  return groups;
}

const RetryIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 7.54619 3.67878 5.3677 5.49902 4H3C2.72386 4 2.5 3.77614 2.5 3.5C2.5 3.22386 2.72386 3 3 3H6.5C6.63261 3 6.75975 3.05272 6.85352 3.14648C6.92392 3.21689 6.97106 3.30611 6.99023 3.40234L7 3.5V7C7 7.27614 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.27614 6 7V4.87891C4.4782 6.06926 3.5 7.91979 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977Z" />
  </svg>
);

const CustomCopyIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12.5 3C13.3284 3 14 3.67157 14 4.5V6H15.5C16.3284 6 17 6.67157 17 7.5V15.5C17 16.3284 16.3284 17 15.5 17H7.5C6.67157 17 6 16.3284 6 15.5V14H4.5C3.67157 14 3 13.3284 3 12.5V4.5C3 3.67157 3.67157 3 4.5 3H12.5ZM14 12.5C14 13.3284 13.3284 14 12.5 14H7V15.5C7 15.7761 7.22386 16 7.5 16H15.5C15.7761 16 16 15.7761 16 15.5V7.5C16 7.22386 15.7761 7 15.5 7H14V12.5ZM4.5 4C4.22386 4 4 4.22386 4 4.5V12.5C4 12.7761 4.22386 13 4.5 13H12.5C12.7761 13 13 12.7761 13 12.5V4.5C13 4.22386 12.7761 4 12.5 4H4.5Z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.56055 2C11.1381 2.00009 12.3211 3.44332 12.0117 4.99023L11.6094 7H13.8438C15.5431 7 16.836 8.52594 16.5566 10.2021L15.876 14.2842C15.6148 15.8513 14.2586 17 12.6699 17H4.5C3.67157 17 3 16.3284 3 15.5V9.23828C3.00013 8.57996 3.4294 7.99838 4.05859 7.80469L5.19824 7.4541L5.33789 7.40723C6.02983 7.15302 6.59327 6.63008 6.89746 5.9541L8.41113 2.58984L8.48047 2.46094C8.66235 2.17643 8.97898 2.00002 9.32324 2H9.56055ZM7.80957 6.36523C7.39486 7.2867 6.62674 7.99897 5.68359 8.3457L5.49219 8.41016L4.35254 8.76074C4.14305 8.82539 4.00013 9.01904 4 9.23828V15.5C4 15.7761 4.22386 16 4.5 16H12.6699C13.7697 16 14.7087 15.2049 14.8896 14.1201L15.5703 10.0381C15.7481 8.97141 14.9251 8 13.8438 8H11C10.8503 8 10.7083 7.9331 10.6133 7.81738C10.5184 7.70164 10.4805 7.54912 10.5098 7.40234L11.0312 4.79395C11.2167 3.86589 10.507 3.00009 9.56055 3H9.32324L7.80957 6.36523Z" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg
    width="20"
    height="20"
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
  }: MessageRowProps) {
    const branchVersions = message.branchVersions?.length ?? 1;
    const activeBranchIndex = message.activeBranchIndex ?? branchVersions - 1;
    const [previewAttachment, setPreviewAttachment] =
      React.useState<MessageAttachment | null>(null);
    const { ref: visibilityRef, detailLevel } = useMessageDetailLevel(
      message.role === "assistant",
      !!message.isStreaming,
    );
    const renderDetailLevel: MessageDetailLevel =
      forcedDetailLevel ?? detailLevel;
    const { shouldAnimate, markEntered } = useMessageEnterAnimation(
      messageUiKey(message),
      true,
    );
    const messageSources = React.useMemo(
      () => (message.role === "assistant" ? collectMessageSources(message) : []),
      [message],
    );

    return (
      <div
        ref={visibilityRef}
        className={cn(
          "group flex w-full max-w-full flex-col",
          shouldAnimate && "animate-in fade-in duration-500",
          message.role === "user" ? "items-stretch" : "items-start",
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
                  role="button"
                  tabIndex={0}
                  onClick={() => onStartEdit(message)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onStartEdit(message);
                    }
                  }}
                  className="user-message-card__body no-hover-overlay w-full cursor-pointer rounded-[15px] px-3 py-2.5 text-left transition-colors sm:rounded-[17px] sm:px-4 sm:py-3"
                  aria-label="Edit message"
                >
                  {message.attachments && message.attachments.length > 0 ? (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {message.attachments.map((attachment) => (
                        <AttachmentChip
                          key={attachment.id}
                          file={attachment}
                          size="sm"
                          onOpen={() =>
                            setPreviewAttachment({
                              ...attachment,
                              previewUrl:
                                attachment.previewUrl ||
                                (attachment.fileId
                                  ? `/api/v1/files/${attachment.fileId}/url?redirect=1`
                                  : undefined),
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  {message.content.trim() ? (
                    <p
                      className="overflow-hidden whitespace-pre-wrap text-[13.5px] font-[430] leading-[1.55] text-zinc-900 sm:text-[14px] sm:leading-[1.58]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: USER_MESSAGE_PREVIEW_LINES,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {message.content}
                    </p>
                  ) : null}
                </div>
              )}
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
              {branchVersions > 1 && editingMessageId !== message.id ? (
                <div className="user-message-actions mt-0.5 flex h-7 items-center justify-end gap-0">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <HintTooltip content="Previous version" side="bottom">
                      <button
                        type="button"
                        onClick={() => onSwitchBranch(message.id, "prev")}
                        disabled={activeBranchIndex <= 0}
                        className="flex h-8 w-6 items-center justify-center rounded-md hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M13.24 3.072a.5.5 0 0 1 .667.718l-.067.076L7.233 10l6.607 6.134a.5.5 0 1 1-.68.732l-7-6.5-.068-.077a.5.5 0 0 1 .068-.655l7-6.5z" />
                        </svg>
                      </button>
                    </HintTooltip>
                    <span className="min-w-[34px] text-center text-[12px] font-[430]">
                      {activeBranchIndex + 1} / {branchVersions}
                    </span>
                    <HintTooltip content="Next version" side="bottom">
                      <button
                        type="button"
                        onClick={() => onSwitchBranch(message.id, "next")}
                        disabled={activeBranchIndex >= branchVersions - 1}
                        className="flex h-8 w-6 items-center justify-center rounded-md hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M6.134 3.16a.5.5 0 0 1 .626-.088l.08.062 7 6.5a.5.5 0 0 1 .068.655l-.068.077-7 6.5a.5.5 0 1 1-.68-.732L12.767 10 6.16 3.866l-.067-.076a.5.5 0 0 1 .04-.63" />
                        </svg>
                      </button>
                    </HintTooltip>
                  </div>
                </div>
              ) : null}
            </div>
        ) : (
          <div
            className={cn(
              "assistant-message group w-full min-w-0 max-w-full text-gray-800 leading-[1.68]",
            )}
          >
            {shouldUseAgentMessageLayout(message) ? (
              <div
                data-message-id={message.id}
                data-assistant-content="true"
                className="min-w-0 w-full"
              >
                <AgentMessageContent
                  message={message}
                  detailLevel={renderDetailLevel}
                />
              </div>
            ) : (
              <>
                {(message.hasThinking ||
                  (message.thinkingContent?.trim().length ?? 0) > 0) && (
                  <ThinkingBlock
                    content={message.thinkingContent}
                    isStreaming={!!message.isThinkingStreaming}
                    thinkingDurationSeconds={message.thinkingDurationSeconds}
                    thinkingStartedAtMs={message.thinkingStartedAtMs}
                    className="mb-4"
                  />
                )}
                {message.isStreaming && message.content.length === 0 && (
                  <div className="flex items-center py-1.5">
                    <StreamingOrbCursor />
                  </div>
                )}
                {message.content.length > 0 ? (
                  <div
                    data-message-id={message.id}
                    data-assistant-content="true"
                    className="min-w-0"
                  >
                    <AssistantContentRenderer
                      content={message.content}
                      messageId={message.id}
                      isStreaming={!!message.isStreaming}
                      streamKey={messageUiKey(message)}
                      detailLevel={renderDetailLevel}
                      agentArtifacts={message.agentArtifacts}
                      {...({ sources: messageSources } as any)}
                    />
                  </div>
                ) : null}
              </>
            )}
            {(shouldUseAgentMessageLayout(message) ||
              message.content.trim().length > 0) &&
            !message.isStreaming ? (
              <>
                  <div className="relative mt-2 flex flex-wrap items-center gap-0.5 font-sans text-zinc-500 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                      <HintTooltip content="Copy" side="bottom" align="start">
                        <button
                          type="button"
                          aria-label="Copy message"
                          onClick={() => onCopy(message.id, message.content)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-zinc-100"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <CustomCopyIcon />
                          )}
                        </button>
                      </HintTooltip>
                      <HintTooltip content="Positive feedback" side="bottom">
                        <button
                          type="button"
                          aria-label="Positive feedback"
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-zinc-100"
                        >
                          <ThumbsUpIcon />
                        </button>
                      </HintTooltip>
                      <HintTooltip content="Negative feedback" side="bottom">
                        <button
                          type="button"
                          aria-label="Negative feedback"
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-zinc-100"
                        >
                          <ThumbsDownIcon />
                        </button>
                      </HintTooltip>
                      <HintTooltip content="Retry" side="bottom">
                        <button
                          type="button"
                          aria-label="Retry"
                          onClick={() => onRetryAssistant(message.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-zinc-100"
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-zinc-100"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </HintTooltip>
                      <div className="relative" data-more-trigger>
                        <HintTooltip content="More" side="bottom">
                          <button
                            type="button"
                            aria-label="More actions"
                            aria-expanded={moreMenuId === message.id}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              onToggleMoreMenu?.(message.id, rect);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </HintTooltip>
                      </div>
                      {messageSources.length > 0 ? (
                        <HintTooltip content="Sources" side="bottom">
                          <button
                            type="button"
                            onClick={() => onOpenSources?.(message.id)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 text-[12px] font-medium text-zinc-600 transition-all hover:border-zinc-300 hover:bg-zinc-50"
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
                                  className="h-4 w-4 rounded-full border border-white bg-white"
                                />
                              ))}
                            </span>
                            <Search className="h-3.5 w-3.5" />
                            <span>Sources</span>
                          </button>
                        </HintTooltip>
                      ) : null}
                      {branchVersions > 1 ? (
                        <div className="ml-0.5 flex items-center gap-1 text-zinc-500">
                          <HintTooltip content="Previous version" side="bottom">
                            <button
                              type="button"
                              onClick={() => onSwitchBranch(message.id, "prev")}
                              disabled={activeBranchIndex <= 0}
                              className="flex h-8 w-6 items-center justify-center rounded-md hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M6.134 3.16a.5.5 0 0 1 .626-.088l.08.062 7 6.5a.5.5 0 0 1 .068.655l-.068.077-7 6.5a.5.5 0 1 1-.68-.732L12.767 10 6.16 3.866l-.067-.076a.5.5 0 0 1 .04-.63" />
                              </svg>
                            </button>
                          </HintTooltip>
                          <span className="min-w-[34px] text-center text-[12px] font-[430]">
                            {activeBranchIndex + 1} / {branchVersions}
                          </span>
                          <HintTooltip content="Next version" side="bottom">
                            <button
                              type="button"
                              onClick={() => onSwitchBranch(message.id, "next")}
                              disabled={activeBranchIndex >= branchVersions - 1}
                              className="flex h-8 w-6 items-center justify-center rounded-md hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M13.24 3.072a.5.5 0 0 1 .667.718l-.067.076L7.233 10l6.607 6.134a.5.5 0 1 1-.68.732l-7-6.5-.068-.077a.5.5 0 0 1 .068-.655l7-6.5z" />
                              </svg>
                            </button>
                          </HintTooltip>
                        </div>
                      ) : null}
                  </div>
                  {typeof message.messagesRemaining === "number" ? (
                    <p className="mt-2 font-sans text-[12px] font-[430] leading-snug text-zinc-400">
                      {formatDemoMessagesRemainingLabel(
                        message.messagesRemaining,
                      )}
                    </p>
                  ) : null}
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
      pm.activeAgentFrameIndex === nm.activeAgentFrameIndex &&
      agentSegmentsVisuallyEqual(pm.agentSegments, nm.agentSegments) &&
      agentFramesVisuallyEqual(pm.agentFrames, nm.agentFrames) &&
      pm.activeBranchIndex === nm.activeBranchIndex &&
      pm.branchVersions === nm.branchVersions &&
      pm.attachments === nm.attachments &&
      pm.messagesRemaining === nm.messagesRemaining &&
      prev.editingMessageId === next.editingMessageId &&
      prev.editValue === next.editValue &&
      prev.copiedId === next.copiedId &&
      prev.forcedDetailLevel === next.forcedDetailLevel &&
      prev.moreMenuId === next.moreMenuId
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
  }: ConversationTurnProps) {
    const turnRootRef = React.useRef<HTMLDivElement>(null);
    const userMsgHostRef = React.useRef<HTMLDivElement>(null);

    const isEditingUser =
      !!userMessage && editingMessageId === userMessage.id;

    // Measure user message height for code-header sticky offset (layout effect
    // so --turn-user-msg-height is ready before first paint / sticky sync).
    // Re-run when entering/leaving edit — editor height differs from preview.
    React.useLayoutEffect(() => {
      const turnEl = turnRootRef.current;
      const hostEl = userMsgHostRef.current;
      if (!turnEl || !hostEl || !userMessage) return;

      const updateVar = () => {
        const h = hostEl.offsetHeight || 0;
        const next = `${h}px`;
        if (turnEl.style.getPropertyValue("--turn-user-msg-height") !== next) {
          turnEl.style.setProperty("--turn-user-msg-height", next);
          turnEl.dispatchEvent(
            new CustomEvent("clauxen-turn-metrics", { bubbles: true }),
          );
        }
      };

      updateVar();

      const ro = new ResizeObserver(updateVar);
      ro.observe(hostEl);

      return () => {
        ro.disconnect();
        turnEl.style.removeProperty("--turn-user-msg-height");
      };
    }, [userMessage, isEditingUser]);

    return (
      <div
        ref={turnRootRef}
        data-conversation-turn
        data-turn-index={turnIndex}
        data-turn-streaming={
          assistantMessages.some((message) => message.isStreaming) || undefined
        }
        className="relative flex w-full flex-col gap-3 sm:gap-4"
        style={{ "--turn-index": turnIndex } as React.CSSProperties}
      >
        {userMessage && (
          <>
            <div className="sticky-user-msg-sentinel" aria-hidden />
            <div
              ref={userMsgHostRef}
              data-sticky-user-msg
              data-user-msg-editing={isEditingUser ? "true" : undefined}
              className="sticky-user-msg-host sticky-user-msg w-full max-w-full shrink-0"
            >
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
              />
            </div>
          </>
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
        pa.agentMode !== na.agentMode ||
        pa.agentFrameComplete !== na.agentFrameComplete ||
        !agentSegmentsVisuallyEqual(pa.agentSegments, na.agentSegments) ||
        !agentFramesVisuallyEqual(pa.agentFrames, na.agentFrames) ||
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
      prev.turnIndex === next.turnIndex
    );
  },
);

function readHeaderHeightPx(from?: Element | null) {
  const scope =
    from?.closest("[data-chat-active], [data-chat-streaming], .login-demo-stage") ??
    document.documentElement;
  const raw = getComputedStyle(scope).getPropertyValue("--header-height");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 35;
}

function resolveActiveStickyTurnIndex(
  viewport: HTMLElement,
  turnCount: number,
  _isGenerating: boolean,
): number {
  if (turnCount <= 0) return 0;

  const stickyY = viewport.getBoundingClientRect().top + readHeaderHeightPx(viewport);
  const turns = viewport.querySelectorAll<HTMLElement>(
    "[data-conversation-turn]",
  );

  // Near the bottom (stream-follow or resting after a reply), always pin the
  // last turn. This keeps code/table headers sticky through generation-end
  // remounts and avoids the sticky-turn flip that jumped the viewport.
  // Skip when content fits the viewport (maxTop≈0) — use spanning instead.
  const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const nearBottom = maxTop > 48 && maxTop - viewport.scrollTop <= 140;
  if (nearBottom) {
    return Math.max(0, turnCount - 1);
  }

  let next = Math.max(0, turnCount - 1);
  let foundSpanning = false;

  for (let i = turns.length - 1; i >= 0; i--) {
    const el = turns[i];
    const index = Number(el.dataset.turnIndex);
    if (Number.isNaN(index)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.top <= stickyY + 1 && rect.bottom > stickyY + 1) {
      next = index;
      foundSpanning = true;
      break;
    }
  }

  if (!foundSpanning) {
    for (let i = 0; i < turns.length; i++) {
      const el = turns[i];
      const index = Number(el.dataset.turnIndex);
      if (Number.isNaN(index)) continue;

      if (el.getBoundingClientRect().bottom > stickyY + 1) {
        next = index;
        break;
      }
    }
  }

  return next;
}

/** Imperative sticky sync — never triggers React re-renders during scroll. */
function syncStickyUserMessages(
  viewport: HTMLElement,
  turnCount: number,
  isGenerating: boolean,
) {
  const activeIndex = resolveActiveStickyTurnIndex(viewport, turnCount, isGenerating);
  const stickyLineY =
    viewport.getBoundingClientRect().top + readHeaderHeightPx(viewport);

  viewport
    .querySelectorAll<HTMLElement>("[data-conversation-turn]")
    .forEach((turn) => {
      const index = Number(turn.dataset.turnIndex);
      if (Number.isNaN(index)) return;

      const nextAttr = index === activeIndex ? "true" : "false";
      if (turn.dataset.stickyActive !== nextAttr) {
        turn.dataset.stickyActive = nextAttr;
      }
    });

  viewport.querySelectorAll<HTMLElement>("[data-sticky-user-msg]").forEach((el) => {
    const turn = el.closest<HTMLElement>("[data-conversation-turn]");
    const index = Number(turn?.dataset.turnIndex);
    if (Number.isNaN(index)) return;

    const isActive = index === activeIndex;

    if (!isActive) {
      if (el.classList.contains("sticky-user-msg--stuck")) {
        el.classList.remove("sticky-user-msg--stuck");
      }
      return;
    }

    const sentinel = turn?.querySelector<HTMLElement>(".sticky-user-msg-sentinel");
    if (!sentinel) {
      if (el.classList.contains("sticky-user-msg--stuck")) {
        el.classList.remove("sticky-user-msg--stuck");
      }
      return;
    }

    const sentinelBottom = sentinel.getBoundingClientRect().bottom;
    const userTop = el.getBoundingClientRect().top;
    // Slightly wider pin slop while editing — expanded host has more subpixel drift.
    const pinSlop = el.dataset.userMsgEditing === "true" ? 4 : 2;
    const isPinned = Math.abs(userTop - stickyLineY) < pinSlop;
    const shouldStuck = isPinned && sentinelBottom < stickyLineY;

    if (el.classList.contains("sticky-user-msg--stuck") !== shouldStuck) {
      el.classList.toggle("sticky-user-msg--stuck", shouldStuck);
    }
  });

  // Keep per-block pin attrs in sync for older CSS / login-demo parity, but
  // primary docking now comes from [data-sticky-active] on the turn (survives
  // Streamdown remount when generation ends).
  syncCodeBlockHeaderPins(viewport, activeIndex);
}

/** Enable code/table header sticky for every block in the active turn (turn-level only). */
function syncCodeBlockHeaderPins(viewport: HTMLElement, activeIndex: number) {
  viewport
    .querySelectorAll<HTMLElement>(".composer-message-codeblock")
    .forEach((block) => {
      const turn = block.closest<HTMLElement>("[data-conversation-turn]");
      const turnIndex = Number(turn?.dataset.turnIndex);
      const nextPin = turnIndex === activeIndex ? "true" : "false";
      if (block.dataset.codeHeaderPin !== nextPin) {
        block.dataset.codeHeaderPin = nextPin;
      }
    });

  viewport
    .querySelectorAll<HTMLElement>(".composer-message-table")
    .forEach((block) => {
      const turn = block.closest<HTMLElement>("[data-conversation-turn]");
      const turnIndex = Number(turn?.dataset.turnIndex);
      const nextPin = turnIndex === activeIndex ? "true" : "false";
      if (block.dataset.tableHeaderPin !== nextPin) {
        block.dataset.tableHeaderPin = nextPin;
      }
    });
}

export function ConversationThread({
  messages,
  onSaveEditedMessage,
  onRetryUserMessage,
  onRetryAssistant,
  onSwitchBranch,
  onOpenSources,
  className,
  scrollAreaRef,
  conversationKey,
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
  const [selectionMenu, setSelectionMenu] = React.useState<null | { x: number; y: number; text: string; messageId: string }>(null);
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
          top:
            placement === "above"
              ? anchor.top - gap
              : anchor.bottom + gap,
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
      if (!target.closest("[data-more-menu]") && !target.closest("[data-more-trigger]")) {
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
          if (still.toString().replace(/\u00a0/g, " ").trim() !== next.text) {
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

  // Click main chat surface (not sidebar) to collapse the inline editor.
  React.useEffect(() => {
    if (!editingMessageId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest("[data-user-message-editing]")) return;
      // Keep edit open when interacting with the sidebar / mobile nav.
      if (
        target.closest(
          "#app-primary-nav, .sidebar-hover-area, [data-sidebar], [data-mobile-nav]",
        )
      ) {
        return;
      }
      // Portaled overlays (attachment preview, menus) live outside the panel.
      if (
        target.closest(
          '[role="dialog"], [data-radix-portal], [data-sonner-toaster]',
        )
      ) {
        return;
      }
      // Only dismiss when the click is inside the main chat/agent panel.
      if (!target.closest('[data-component="agent-panel"]')) return;

      handleCancelEdit();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [editingMessageId, handleCancelEdit]);

  const handleSaveEdit = React.useCallback(
    async (
      messageId: string,
      attachments?: ComposerAttachment[],
      contentOverride?: string,
    ) => {
      const trimmed = (contentOverride ?? editValue).trim();
      if (!trimmed && !(attachments && attachments.length > 0)) return;
      await onSaveEditedMessage(messageId, trimmed, { attachments });
      setEditingMessageId(null);
      setEditValue("");
    },
    [editValue, onSaveEditedMessage],
  );

  const groups = React.useMemo(
    () => groupMessagesIntoTurns(messages),
    [messages],
  );

  const stickyStreamKey = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant" && message.isStreaming) {
        const agentStreamSize = (message.agentFrames ?? []).reduce(
          (frameTotal, frame) =>
            frameTotal +
            frame.segments.reduce((segmentTotal, segment) => {
              if (
                segment.kind === "thinking" ||
                segment.kind === "narration" ||
                segment.kind === "text"
              ) {
                return segmentTotal + segment.content.length;
              }
              if (segment.kind === "tool") {
                return (
                  segmentTotal +
                  (segment.stdout?.length ?? 0) +
                  (segment.stderr?.length ?? 0) +
                  (segment.result?.length ?? 0) +
                  (segment.searchResults?.length ?? 0)
                );
              }
              return segmentTotal;
            }, 0),
          0,
        );
        return `${message.id}:${message.content.length}:${message.thinkingContent?.length ?? 0}:${agentStreamSize}`;
      }
    }
    return "idle";
  }, [messages]);

  const listRef = React.useRef<HTMLDivElement>(null);
  const turnCountRef = React.useRef(groups.length);
  turnCountRef.current = groups.length;
  const stickySyncRef = React.useRef<(() => void) | null>(null);
  const isGeneratingRef = React.useRef(isGeneratingProp);
  isGeneratingRef.current = isGeneratingProp;

  const getScrollElement = React.useCallback(() => {
    if (scrollAreaRef?.current) {
      return (
        scrollAreaRef.current.querySelector<HTMLElement>(
          "[data-radix-scroll-area-viewport]",
        ) ?? scrollAreaRef.current
      );
    }
    return listRef.current;
  }, [scrollAreaRef]);

  // While editing, blur on user-driven viewport scroll so focus/scrollIntoView
  // cannot keep the expanded sticky host pinned when it should release.
  React.useEffect(() => {
    if (!editingMessageId) return;
    const viewport = getScrollElement();
    if (!viewport) return;

    let userScrollArmed = false;
    const armUserScroll = () => {
      userScrollArmed = true;
    };
    const onScrollbarPointerDown = (event: PointerEvent) => {
      if (event.target === viewport) armUserScroll();
    };
    const onViewportScroll = () => {
      if (!userScrollArmed) return;
      userScrollArmed = false;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.closest("[data-user-message-editing]")
      ) {
        active.blur();
      }
      stickySyncRef.current?.();
    };

    viewport.addEventListener("wheel", armUserScroll, { passive: true });
    viewport.addEventListener("touchstart", armUserScroll, { passive: true });
    viewport.addEventListener("pointerdown", onScrollbarPointerDown);
    viewport.addEventListener("scroll", onViewportScroll, { passive: true });

    return () => {
      viewport.removeEventListener("wheel", armUserScroll);
      viewport.removeEventListener("touchstart", armUserScroll);
      viewport.removeEventListener("pointerdown", onScrollbarPointerDown);
      viewport.removeEventListener("scroll", onViewportScroll);
    };
  }, [editingMessageId, getScrollElement]);

  React.useLayoutEffect(() => {
    const viewport = getScrollElement();
    if (!viewport || groups.length === 0) return;

    let syncRaf = 0;
    let disposed = false;
    let scrollEndTimer = 0;
    let mutationTimer = 0;

    const runSync = () => {
      if (disposed) return;
      syncStickyUserMessages(
        viewport,
        turnCountRef.current,
        isGeneratingRef.current,
      );
    };
    stickySyncRef.current = runSync;

    const scheduleSync = () => {
      if (syncRaf !== 0) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        runSync();
      });
    };

    const onTurnMetrics = () => scheduleSync();

    const onViewportScroll = () => {
      scheduleSync();
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(() => {
        runSync();
      }, 130);
    };

    runSync();
    requestAnimationFrame(() => {
      runSync();
      requestAnimationFrame(runSync);
    });
    const settleTimer = window.setTimeout(runSync, 0);
    const lateTimer = window.setTimeout(runSync, 150);

    viewport.addEventListener("scroll", onViewportScroll, { passive: true });
    viewport.addEventListener("clauxen-turn-metrics", onTurnMetrics);
    window.addEventListener("resize", runSync);

    const content = (viewport.firstElementChild as HTMLElement | null) ?? viewport;
    const resizeObserver = new ResizeObserver(() => scheduleSync());
    resizeObserver.observe(content);

    viewport.querySelectorAll<HTMLElement>("[data-sticky-user-msg]").forEach((host) => {
      resizeObserver.observe(host);
    });

    // Always observe subtree so code/table remounts after stream→final
    // markdown still re-pin. Debounce during streaming to avoid token thrash.
    const mutationObserver = new MutationObserver(() => {
      if (isGeneratingRef.current) {
        window.clearTimeout(mutationTimer);
        mutationTimer = window.setTimeout(() => scheduleSync(), 80);
        return;
      }
      scheduleSync();
    });
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
    });

    return () => {
      disposed = true;
      stickySyncRef.current = null;
      if (syncRaf !== 0) {
        cancelAnimationFrame(syncRaf);
      }
      window.clearTimeout(settleTimer);
      window.clearTimeout(lateTimer);
      window.clearTimeout(scrollEndTimer);
      window.clearTimeout(mutationTimer);
      viewport.removeEventListener("scroll", onViewportScroll);
      viewport.removeEventListener("clauxen-turn-metrics", onTurnMetrics);
      window.removeEventListener("resize", runSync);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [getScrollElement, groups.length, conversationKey]);

  React.useEffect(() => {
    stickySyncRef.current?.();
  }, [stickyStreamKey, isFastScrollingProp, isGeneratingProp, editingMessageId]);

  // Generation-end: Streamdown remounts code/table blocks after isStreaming
  // clears. Re-sync sticky turn + pins across a short settle window.
  React.useEffect(() => {
    if (isGeneratingProp) return;
    const viewport = getScrollElement();
    if (!viewport) return;

    const timers: number[] = [];
    const run = () => {
      syncStickyUserMessages(viewport, turnCountRef.current, false);
    };

    run();
    const raf = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    for (const delay of [40, 120, 280, 520]) {
      timers.push(window.setTimeout(run, delay));
    }

    return () => {
      cancelAnimationFrame(raf);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [isGeneratingProp, getScrollElement, stickyStreamKey]);

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
  };

  return (
    <FollowUpPromptProvider
      enabled={followUpsEnabled}
      onSelect={onFollowUpSelect}
    >
    <div
      ref={listRef}
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col gap-4 px-0 pt-5 pb-5 sm:gap-6 sm:px-0 sm:pt-10 sm:pb-8",
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
            group.userMessage
              ? messageUiKey(group.userMessage)
              : `turn-${index}`
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
            className="fixed z-[95] flex items-center overflow-hidden rounded-full border border-zinc-200 bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.28)] animate-in fade-in zoom-in-95 duration-150"
            style={{ left: `${selectionMenu.x}px`, top: `${selectionMenu.y}px` }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-zinc-900 transition hover:bg-zinc-50"
              onClick={() => {
                navigator.clipboard.writeText(selectionMenu.text).catch(() => {});
                setSelectionMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Clauxen
            </button>
            <span className="h-5 w-px bg-zinc-200" aria-hidden />
            <button
              type="button"
              className="px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => {
                navigator.clipboard.writeText(selectionMenu.text).catch(() => {});
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
            className="fixed z-[95] w-[220px] rounded-[14px] border border-zinc-200 bg-white p-1 text-[13px] shadow-[0_10px_30px_-15px_rgba(24,24,27,0.25)]"
            style={{
              left: `${moreMenuAnchor.left}px`,
              top: `${moreMenuAnchor.top}px`,
              transform:
                moreMenuAnchor.placement === "above"
                  ? "translateY(-100%)"
                  : undefined,
            }}
          >
            <div className="px-3 py-1.5 text-[11px] text-zinc-500">
              {moreMenuMessage.createdAt
                ? new Date(moreMenuMessage.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Just now"}
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                closeMoreMenu();
                try {
                  const utter = new SpeechSynthesisUtterance(
                    moreMenuMessage.content.replace(/\s+/g, " ").slice(0, 1200),
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


