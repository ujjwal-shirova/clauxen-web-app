"use client";

import React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ThinkingBlock } from "./thinking-block";
import { AgentMessageContent } from "./agent/agent-message-content";
import { OrbCursor } from "./ui/orb-cursor";
import { HintTooltip } from "./ui/hint-tooltip";
import { messageAnchorId } from "./chat-message-navigator";
import type { Message } from "@/frontend/lib/types";
import { UserMessageExpandDialog } from "./user-message-expand-dialog";
import { cn } from "@/frontend/lib/utils";
import { useMessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";

const USER_MESSAGE_PREVIEW_LINES = 2;

interface ConversationThreadProps {
  messages: Message[];
  onSaveEditedMessage: (
    messageId: string,
    newContent: string,
  ) => Promise<void> | void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  className?: string;
  scrollAreaRef?: React.RefObject<HTMLDivElement | null>;
  /** When true, off-screen rows render lightweight placeholders (fast scroll). */
  isFastScrolling?: boolean;
}

type ConversationTurnGroup = {
  userMessage: Message | null;
  assistantMessages: Message[];
};

function groupMessagesIntoTurns(messages: Message[]): ConversationTurnGroup[] {
  const groups: ConversationTurnGroup[] = [];
  messages.forEach((msg) => {
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

const EditPenIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9.72821 2.87934C10.0318 2.10869 10.9028 1.72933 11.6735 2.03266L14.4655 3.13226C15.236 3.43593 15.6145 4.30697 15.3112 5.07758L11.3903 15.0307C11.2954 15.2717 11.1394 15.4835 10.9391 15.6459L10.8513 15.7123L7.7077 17.8979C7.29581 18.1843 6.73463 17.9917 6.57294 17.5356L6.54657 17.4409L5.737 13.6987C5.67447 13.4092 5.69977 13.107 5.80829 12.8315L9.72821 2.87934ZM6.73798 13.1987C6.70201 13.2903 6.69385 13.3906 6.71454 13.4868L7.44501 16.8627L10.28 14.892L10.3376 14.8452C10.3909 14.7949 10.4325 14.7332 10.4597 14.6645L13.0974 7.96723L9.37567 6.50141L6.73798 13.1987ZM11.3073 2.96332C11.0504 2.86217 10.7601 2.98864 10.6589 3.24555L9.74188 5.57074L13.4636 7.03754L14.3806 4.71137C14.4817 4.45445 14.3552 4.16413 14.0983 4.06293L11.3073 2.96332Z" />
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
  onSaveEdit: (messageId: string) => void;
  onCopy: (id: string, text: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  isFastScrolling?: boolean;
  forcedDetailLevel?: MessageDetailLevel;
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
    onRetryAssistant,
    onSwitchBranch,
    isFastScrolling = false,
    forcedDetailLevel,
  }: MessageRowProps) {
    const branchVersions = message.branchVersions?.length ?? 1;
    const activeBranchIndex = message.activeBranchIndex ?? branchVersions - 1;
    const [expandOpen, setExpandOpen] = React.useState(false);
    const { ref: visibilityRef, detailLevel } = useMessageDetailLevel(
      message.role === "assistant",
      !!message.isStreaming,
    );
    const renderDetailLevel: MessageDetailLevel =
      forcedDetailLevel ??
      (isFastScrolling ? "placeholder" : detailLevel);

    if (isFastScrolling && message.role === "assistant" && !message.isStreaming) {
      return (
        <div
          className="min-h-[72px] w-full rounded-lg bg-zinc-50/80"
          style={{ containIntrinsicSize: "72px" }}
          aria-hidden
        />
      );
    }

    return (
      <div
        ref={visibilityRef}
        className={cn(
          "group flex w-full flex-col animate-in fade-in duration-500",
          message.role === "user" ? "items-stretch" : "items-start",
        )}
        style={{ contentVisibility: "auto", containIntrinsicSize: "240px" }}
      >
        {message.role === "user" ? (
            <div
              id={messageAnchorId(message.id)}
              className="user-message-card flex w-full scroll-mt-20 flex-col font-sans"
            >
              <button
                type="button"
                onClick={() => setExpandOpen(true)}
                className="user-message-card__body w-full cursor-pointer rounded-[18px] px-3.5 py-3 text-left transition-colors hover:bg-zinc-200/60 sm:rounded-[20px] sm:px-5 sm:py-4"
                aria-label="Expand user message"
              >
                <p
                  className="overflow-hidden whitespace-pre-wrap text-[14px] font-[430] leading-[1.6] text-zinc-900 sm:text-[15px] sm:leading-[1.65]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: USER_MESSAGE_PREVIEW_LINES,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {message.content}
                </p>
              </button>
              <UserMessageExpandDialog
                open={expandOpen}
                onOpenChange={setExpandOpen}
                message={message}
                isEditing={editingMessageId === message.id}
                editValue={
                  editingMessageId === message.id ? (editValue ?? "") : ""
                }
                copiedId={copiedId}
                onStartEdit={onStartEdit}
                onEditValueChange={onEditValueChange}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onCopy={onCopy}
                onSwitchBranch={onSwitchBranch}
              />
              <div className="user-message-actions mt-1 flex h-8 items-center justify-end gap-0">
                <HintTooltip content="Retry">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition-all">
                    <RetryIcon />
                  </button>
                </HintTooltip>
                <HintTooltip content="Edit">
                  <button
                    onClick={() => {
                      onStartEdit(message);
                      setExpandOpen(true);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition-all"
                  >
                    <EditPenIcon />
                  </button>
                </HintTooltip>
                <HintTooltip content="Copy">
                  <button
                    onClick={() => onCopy(message.id, message.content)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500 transition-all"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <CustomCopyIcon />
                    )}
                  </button>
                </HintTooltip>
                {branchVersions > 1 ? (
                  <div className="ml-1 flex items-center gap-1 text-zinc-500">
                    <HintTooltip content="Previous version">
                      <button
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
                    <HintTooltip content="Next version">
                      <button
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
                ) : null}
              </div>
            </div>
        ) : (
          <div
            className={cn(
              "assistant-message group w-full min-w-0 max-w-full overflow-hidden text-gray-800 leading-relaxed",
              message.isStreaming && "[contain:layout_style]",
            )}
          >
            {message.agentMode ||
            (message.agentSegments && message.agentSegments.length > 0) ? (
              <AgentMessageContent
                message={message}
                detailLevel={renderDetailLevel}
              />
            ) : (
              <>
                {(message.hasThinking ||
                  (message.thinkingContent?.trim().length ?? 0) > 0) && (
                  <ThinkingBlock
                    content={message.thinkingContent}
                    isStreaming={!!message.isThinkingStreaming}
                    thinkingDurationSeconds={message.thinkingDurationSeconds}
                    className="mb-4"
                  />
                )}
                {message.isStreaming && message.content.trim().length === 0 && (
                  <div className="flex items-center py-1">
                    <OrbCursor />
                  </div>
                )}
                {message.content.trim().length > 0 ? (
                  <MarkdownRenderer
                    content={message.content}
                    isStreaming={!!message.isStreaming}
                    streamKey={message.id}
                    detailLevel={renderDetailLevel}
                  />
                ) : null}
              </>
            )}
            {(message.agentMode ||
              (message.agentSegments && message.agentSegments.length > 0) ||
              message.content.trim().length > 0) &&
            !message.isStreaming ? (
              <>
                  <div className="mt-3 flex items-center justify-start gap-1 font-sans text-zinc-500 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                    <HintTooltip content="Copy">
                      <button
                        onClick={() => onCopy(message.id, message.content)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-all"
                      >
                        <CustomCopyIcon />
                      </button>
                    </HintTooltip>
                    <HintTooltip content="Positive feedback">
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-all">
                        <ThumbsUpIcon />
                      </button>
                    </HintTooltip>
                    <HintTooltip content="Negative feedback">
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-all">
                        <ThumbsDownIcon />
                      </button>
                    </HintTooltip>
                    <HintTooltip content="Retry">
                      <button
                        onClick={() => onRetryAssistant(message.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-all"
                      >
                        <RetryIcon />
                      </button>
                    </HintTooltip>
                    {branchVersions > 1 ? (
                      <div className="ml-1 flex items-center gap-1 text-zinc-500">
                        <HintTooltip content="Previous version">
                          <button
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
                        <HintTooltip content="Next version">
                          <button
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
      (pm.agentSegments?.length ?? 0) === (nm.agentSegments?.length ?? 0) &&
      pm.agentSegments?.[pm.agentSegments.length - 1]?.id ===
        nm.agentSegments?.[nm.agentSegments.length - 1]?.id &&
      (pm.agentSegments?.[pm.agentSegments.length - 1]?.kind === "tool"
        ? (pm.agentSegments[pm.agentSegments.length - 1] as { status?: string })
            .status ===
          (nm.agentSegments?.[nm.agentSegments.length - 1] as { status?: string })
            ?.status
        : true) &&
      pm.activeBranchIndex === nm.activeBranchIndex &&
      pm.branchVersions === nm.branchVersions &&
      prev.editingMessageId === next.editingMessageId &&
      prev.editValue === next.editValue &&
      prev.copiedId === next.copiedId
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
  onSaveEdit: (messageId: string) => void;
  onCopy: (id: string, text: string) => void;
  onRetryAssistant: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  isFastScrolling?: boolean;
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
    onRetryAssistant,
    onSwitchBranch,
    isFastScrolling = false,
  }: ConversationTurnProps) {
    const userMsgRef = React.useRef<HTMLDivElement>(null);
    const stickySentinelRef = React.useRef<HTMLDivElement>(null);
    const [userMsgHeight, setUserMsgHeight] = React.useState(0);
    const [isUserMsgStuck, setIsUserMsgStuck] = React.useState(false);

    React.useEffect(() => {
      const sentinel = stickySentinelRef.current;
      if (!sentinel || !userMessage) {
        setIsUserMsgStuck(false);
        return;
      }

      const scrollRoot = sentinel.closest(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null;

      const updateStuck = () => {
        const userEl = userMsgRef.current;
        if (!sentinel || !userEl) return;

        const stickyTop = parseFloat(getComputedStyle(userEl).top) || 44;
        const sentinelBottom = sentinel.getBoundingClientRect().bottom;
        const userTop = userEl.getBoundingClientRect().top;
        const isPinned = Math.abs(userTop - stickyTop) < 2;

        setIsUserMsgStuck(isPinned && sentinelBottom < stickyTop);
      };

      updateStuck();
      scrollRoot?.addEventListener("scroll", updateStuck, { passive: true });
      window.addEventListener("resize", updateStuck);

      const resizeObserver = new ResizeObserver(updateStuck);
      resizeObserver.observe(sentinel);
      if (scrollRoot) resizeObserver.observe(scrollRoot);

      return () => {
        scrollRoot?.removeEventListener("scroll", updateStuck);
        window.removeEventListener("resize", updateStuck);
        resizeObserver.disconnect();
      };
    }, [userMessage]);

    React.useEffect(() => {
      const el = userMsgRef.current;
      if (!el) {
        setUserMsgHeight(0);
        return;
      }

      setUserMsgHeight(el.offsetHeight);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height =
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          setUserMsgHeight(height);
        }
      });

      observer.observe(el);
      return () => {
        observer.disconnect();
      };
    }, [userMessage]);

    return (
      <div
        className="relative flex w-full flex-col gap-6 sm:gap-8"
        style={
          {
            "--user-msg-height": `${userMsgHeight}px`,
          } as React.CSSProperties
        }
      >
        {userMessage && (
          <>
            <div
              ref={stickySentinelRef}
              className="sticky-user-msg-sentinel"
              aria-hidden
            />
            <div
              ref={userMsgRef}
              className={cn(
                "sticky-user-msg",
                isUserMsgStuck && "sticky-user-msg--stuck",
              )}
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
                onRetryAssistant={onRetryAssistant}
                onSwitchBranch={onSwitchBranch}
                isFastScrolling={isFastScrolling}
              />
            </div>
          </>
        )}
        {assistantMessages.map((msg) => (
          <MessageRow
            key={msg.id}
            message={msg}
            editingMessageId={editingMessageId}
            editValue={editingMessageId === msg.id ? editValue : undefined}
            copiedId={copiedId}
            onEditValueChange={onEditValueChange}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onCopy={onCopy}
            onRetryAssistant={onRetryAssistant}
            onSwitchBranch={onSwitchBranch}
            isFastScrolling={isFastScrolling}
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
        pa.activeBranchIndex !== na.activeBranchIndex ||
        pa.branchVersions !== na.branchVersions
      ) {
        return false;
      }
    }

    return (
      prev.editingMessageId === next.editingMessageId &&
      prev.editValue === next.editValue &&
      prev.copiedId === next.copiedId
    );
  },
);

export function ConversationThread({
  messages,
  onSaveEditedMessage,
  onRetryAssistant,
  onSwitchBranch,
  className,
  scrollAreaRef,
  isFastScrolling = false,
}: ConversationThreadProps) {
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null,
  );
  const [editValue, setEditValue] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = React.useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleStartEdit = React.useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setEditValue(message.content);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setEditingMessageId(null);
    setEditValue("");
  }, []);

  const handleSaveEdit = React.useCallback(
    async (messageId: string) => {
      const trimmed = editValue.trim();
      if (!trimmed) return;
      await onSaveEditedMessage(messageId, trimmed);
      setEditingMessageId(null);
      setEditValue("");
    },
    [editValue, onSaveEditedMessage],
  );

  const groups = React.useMemo(
    () => groupMessagesIntoTurns(messages),
    [messages],
  );

  const listRef = React.useRef<HTMLDivElement>(null);

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

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement,
    estimateSize: () => 280,
    getItemKey: (index) =>
      groups[index]?.userMessage?.id ?? `turn-${index}`,
    overscan: 4,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: 80,
    useFlushSync: false,
  });

  const turnProps = {
    editingMessageId,
    copiedId,
    onEditValueChange: setEditValue,
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onSaveEdit: handleSaveEdit,
    onCopy: handleCopy,
    onRetryAssistant,
    onSwitchBranch,
    isFastScrolling,
  };

  if (groups.length <= 12) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 max-w-full flex-col gap-6 px-0 pt-8 pb-6 sm:gap-9 sm:px-0 sm:pt-16 sm:pb-10",
          className,
        )}
        data-virtual-scroll
      >
        {groups.map((group, index) => (
          <ConversationTurn
            key={group.userMessage?.id || `turn-${index}`}
            userMessage={group.userMessage}
            assistantMessages={group.assistantMessages}
            editValue={
              editingMessageId === group.userMessage?.id ? editValue : undefined
            }
            {...turnProps}
          />
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={listRef}
      data-virtual-scroll
      className={cn(
        "relative w-full min-w-0 max-w-full px-0 pt-8 pb-6 sm:px-0 sm:pt-16 sm:pb-10",
        className,
      )}
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualItems.map((virtualRow) => {
        const group = groups[virtualRow.index];
        if (!group) return null;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full pb-8 sm:pb-9"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <ConversationTurn
              userMessage={group.userMessage}
              assistantMessages={group.assistantMessages}
              editValue={
                editingMessageId === group.userMessage?.id
                  ? editValue
                  : undefined
              }
              {...turnProps}
            />
          </div>
        );
      })}
    </div>
  );
}
