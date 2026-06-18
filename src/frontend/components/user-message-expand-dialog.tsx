"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { HintTooltip } from "./ui/hint-tooltip";
import type { Message } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";

/** 15px text × 1.65 line-height × 20 lines */
const DIALOG_SCROLL_MAX_HEIGHT = "calc(1.65 * 15px * 20)";

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

const InfoIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 256 256"
    fill="currentColor"
    className="shrink-0 mt-0.5 text-zinc-500"
    aria-hidden
  >
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
  </svg>
);

type UserMessageExpandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
  isEditing: boolean;
  editValue: string;
  copiedId: string | null;
  onStartEdit: (message: Message) => void;
  onEditValueChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string) => void | Promise<void>;
  onCopy: (id: string, text: string) => void;
  onRetryUserMessage: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
};

export function UserMessageExpandDialog({
  open,
  onOpenChange,
  message,
  isEditing,
  editValue,
  copiedId,
  onStartEdit,
  onEditValueChange,
  onCancelEdit,
  onSaveEdit,
  onCopy,
  onRetryUserMessage,
  onSwitchBranch,
}: UserMessageExpandDialogProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const branchVersions = message.branchVersions?.length ?? 1;
  const activeBranchIndex = message.activeBranchIndex ?? branchVersions - 1;

  React.useEffect(() => {
    if (!open || !isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
  }, [open, isEditing]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onCancelEdit();
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    await onSaveEdit(message.id);
    onOpenChange(false);
  };

  const handleCancelEditInDialog = () => {
    onCancelEdit();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-white/75",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-full max-w-[min(640px,calc(100vw-2rem))] max-h-[min(90dvh,calc(1.65*15px*20+8rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white p-5 font-sans shadow-[0_8px_24px_-8px_rgba(24,24,27,0.12),0_0_0_1px_rgba(24,24,27,0.04)] focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {isEditing ? "Edit user message" : "User message"}
          </DialogPrimitive.Title>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            style={{ maxHeight: DIALOG_SCROLL_MAX_HEIGHT }}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                className="block w-full min-h-[3.3rem] resize-none border-0 bg-transparent p-0 font-sans text-[15px] font-[430] leading-[1.65] text-zinc-900 outline-none focus:ring-0"
                rows={Math.min(20, Math.max(3, editValue.split("\n").length + 1))}
                aria-label="Edit message"
              />
            ) : (
              <p className="whitespace-pre-wrap text-[15px] font-[430] leading-[1.65] text-zinc-900">
                {message.content}
              </p>
            )}
          </div>

          {isEditing ? (
            <div className="mt-4 shrink-0 border-t border-zinc-100 pt-3">
              <div className="mb-3 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-600 sm:text-[12px]">
                <InfoIcon />
                <span>
                  Editing this message will create a new conversation branch.
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditInDialog}
                  className="h-9 rounded-lg border border-zinc-300 px-4 text-[14px] font-medium transition-colors hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!editValue.trim()}
                  className="no-hover-overlay h-9 rounded-lg bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex shrink-0 items-center justify-end gap-0 border-t border-zinc-100 pt-3">
              <HintTooltip content="Retry">
                <button
                  type="button"
                  onClick={() => {
                    onRetryUserMessage(message.id);
                    onOpenChange(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
                >
                  <RetryIcon />
                </button>
              </HintTooltip>
              <HintTooltip content="Edit">
                <button
                  type="button"
                  onClick={() => onStartEdit(message)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
                >
                  <EditPenIcon />
                </button>
              </HintTooltip>
              <HintTooltip content="Copy">
                <button
                  type="button"
                  onClick={() => onCopy(message.id, message.content)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
                >
                  {copiedId === message.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <CustomCopyIcon />
                  )}
                </button>
              </HintTooltip>
              {branchVersions > 1 ? (
                <div className="ml-1 flex items-center gap-1 text-zinc-500">
                  <HintTooltip content="Previous version">
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
                  <HintTooltip content="Next version">
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
              ) : null}
            </div>
          )}

          <DialogPrimitive.Close
            type="button"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
