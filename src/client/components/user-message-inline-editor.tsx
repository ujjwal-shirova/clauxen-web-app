"use client";

import * as React from "react";
import { Check, LoaderCircle, Mic, Paperclip, X } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { AttachmentChip } from "@/components/composer/attachment-chip";
import { AttachmentPreviewHost } from "@/components/composer/attachment-preview-host";
import { ComposerAttachmentStrip } from "@/components/composer/attachment-strip";
import {
  COMPOSER_FILE_ACCEPT,
  classifyComposerFile,
  readTextPreview,
  type ComposerAttachment,
  type MessageAttachment,
} from "@/lib/composer-attachments";
import { useStreamingDictation } from "@/features/dictation/use-streaming-dictation";
import type { CaretRange } from "@/features/dictation/transcript";
import { cn } from "@/lib/utils";

const MAX_EDIT_LINES = 10;
const EDIT_LINE_HEIGHT_PX = 24;

function messageToComposerAttachments(
  attachments: MessageAttachment[] | undefined,
): ComposerAttachment[] {
  if (!attachments?.length) return [];
  return attachments.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    kind: item.kind,
    previewUrl:
      item.previewUrl ||
      (item.fileId ? `/api/v1/files/${item.fileId}/url?redirect=1` : ""),
    fileId: item.fileId,
    textPreview: item.textPreview,
    uploadStatus: item.fileId ? "ready" : "local",
  }));
}

export type UserMessageInlineEditorProps = {
  messageId: string;
  initialAttachments?: MessageAttachment[];
  value: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (
    content: string,
    attachments: ComposerAttachment[],
  ) => void | Promise<void>;
  disabled?: boolean;
};

export function UserMessageInlineEditor({
  messageId,
  initialAttachments,
  value,
  onValueChange,
  onCancel,
  onSubmit,
  disabled = false,
}: UserMessageInlineEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const applyingDictationRef = React.useRef(false);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const attachmentsRef = React.useRef<ComposerAttachment[]>([]);
  const [attachments, setAttachments] = React.useState<ComposerAttachment[]>(
    () => messageToComposerAttachments(initialAttachments),
  );
  attachmentsRef.current = attachments;
  const [attachmentError, setAttachmentError] = React.useState<string | null>(
    null,
  );
  const [previewAttachment, setPreviewAttachment] =
    React.useState<ComposerAttachment | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const pendingCaretRef = React.useRef<CaretRange | null>(null);

  const maxHeightPx = MAX_EDIT_LINES * EDIT_LINE_HEIGHT_PX;
  const trimmed = value.trim();
  const canSubmit =
    (Boolean(trimmed) || attachments.length > 0) &&
    !disabled &&
    !isSubmitting;

  const readDraft = React.useCallback(
    () => textareaRef.current?.value ?? valueRef.current,
    [],
  );
  const readCaret = React.useCallback((): CaretRange => {
    const textarea = textareaRef.current;
    const draft = textarea?.value ?? valueRef.current;
    if (!textarea) return { start: draft.length, end: draft.length };
    return {
      start: textarea.selectionStart ?? draft.length,
      end: textarea.selectionEnd ?? draft.length,
    };
  }, []);
  const applyDictationDraft = React.useCallback(
    (next: string, caret: CaretRange) => {
      applyingDictationRef.current = true;
      pendingCaretRef.current = caret;
      onValueChange(next);
      queueMicrotask(() => {
        applyingDictationRef.current = false;
      });
    },
    [onValueChange],
  );
  const dictation = useStreamingDictation({
    readDraft,
    readCaret,
    onDraftChange: applyDictationDraft,
  });
  const showDictationActions =
    dictation.status === "listening" || dictation.status === "stopping";
  const dictationConnecting = dictation.status === "connecting";

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(
      Math.max(textarea.scrollHeight, EDIT_LINE_HEIGHT_PX * 2),
      maxHeightPx,
    );
    textarea.style.height = `${next}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, [maxHeightPx]);

  React.useLayoutEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const caret = pendingCaretRef.current;
    if (!textarea || !caret) return;
    const start = Math.max(0, Math.min(caret.start, textarea.value.length));
    const end = Math.max(start, Math.min(caret.end, textarea.value.length));
    textarea.setSelectionRange(start, end);
    pendingCaretRef.current = null;
  }, [value]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
    const len = textarea.value.length;
    try {
      textarea.setSelectionRange(len, len);
    } catch {
      // noop
    }
  }, [messageId]);

  React.useEffect(() => {
    return () => {
      for (const item of attachmentsRef.current) {
        if (item.previewUrl?.startsWith("blob:") && item.file) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl?.startsWith("blob:") && target.file) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const ingestFiles = async (files: File[]) => {
    const next: ComposerAttachment[] = [];
    for (const file of files) {
      const kind = classifyComposerFile(file);
      if (!kind) {
        setAttachmentError(
          `"${file.name}" is not a supported attachment type.`,
        );
        continue;
      }
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      if (kind === "image" || kind === "video") {
        next.push({
          id,
          name: file.name,
          previewUrl,
          mimeType:
            file.type || (kind === "video" ? "video/mp4" : "image/png"),
          kind,
          file,
          uploadStatus: "local",
        });
      } else {
        const textPreview = await readTextPreview(file);
        next.push({
          id,
          name: file.name,
          previewUrl,
          mimeType: file.type || "application/octet-stream",
          kind: "document",
          file,
          textPreview,
          uploadStatus: "local",
        });
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
      setAttachmentError(null);
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit) return;
    if (dictation.isActive) {
      await dictation.submit();
    }
    setIsSubmitting(true);
    try {
      await onSubmit(
        valueRef.current,
        attachmentsRef.current.map((item) => ({ ...item })),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, dictation, onSubmit]);

  const listeningEmpty =
    dictation.status === "listening" && !value.trim();

  return (
    <div
      className="user-msg-editor no-hover-overlay w-full text-left"
      data-user-message-editing={messageId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (dictation.isActive) {
            void dictation.cancel();
            return;
          }
          onCancel();
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();
          void handleSubmit();
        }
      }}
    >
      <div className="user-msg-editor__label">
        <span>Edit message</span>
        <span
          className={cn(
            "user-msg-editor__rec",
            dictation.isListening && "user-msg-editor__rec--live",
          )}
          aria-hidden={!dictation.isListening}
        >
          {dictationConnecting
            ? "Connecting…"
            : dictation.isListening
              ? "Listening…"
              : ""}
        </span>
      </div>

      {attachments.length > 0 ? (
        <div className="mb-2.5">
          <ComposerAttachmentStrip>
            {attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                file={attachment}
                size="lg"
                onRemove={() => removeAttachment(attachment.id)}
                onOpen={() => setPreviewAttachment(attachment)}
              />
            ))}
          </ComposerAttachmentStrip>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled || isSubmitting}
        onChange={(event) => {
          if (dictation.isListening && !applyingDictationRef.current) {
            dictation.rebaseToCaret({
              start:
                event.currentTarget.selectionStart ??
                event.target.value.length,
              end:
                event.currentTarget.selectionEnd ?? event.target.value.length,
            });
          }
          onValueChange(event.target.value);
        }}
        onSelect={(event) => {
          if (!dictation.isListening || applyingDictationRef.current) return;
          dictation.rebaseToCaret({
            start:
              event.currentTarget.selectionStart ??
              event.currentTarget.value.length,
            end:
              event.currentTarget.selectionEnd ??
              event.currentTarget.value.length,
          });
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (dictation.isActive) {
              if (showDictationActions) void dictation.submit();
              return;
            }
            void handleSubmit();
          }
        }}
        rows={2}
        placeholder={listeningEmpty ? "Listening…" : "Edit your message…"}
        className="user-msg-editor__input w-full resize-none bg-transparent outline-none"
        style={{
          lineHeight: `${EDIT_LINE_HEIGHT_PX}px`,
          maxHeight: `${maxHeightPx}px`,
        }}
        aria-label="Edit user message"
        data-dictation={
          dictation.status !== "idle" ? dictation.status : undefined
        }
      />
      <span className="sr-only" aria-live="polite">
        {dictationConnecting
          ? "Connecting dictation"
          : dictation.status === "listening"
            ? "Listening"
            : ""}
      </span>

      {attachmentError ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--settings-danger)]">
          {attachmentError}
        </p>
      ) : null}
      {dictation.error ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--settings-danger)]" role="alert">
          {dictation.error}
        </p>
      ) : null}

      <div className="user-msg-editor__footer">
        <div className="flex items-center gap-1">
          <HintTooltip content="Attach files" side="bottom">
            <button
              type="button"
              aria-label="Attach files"
              disabled={disabled || isSubmitting}
              onClick={() => fileInputRef.current?.click()}
              className="user-msg-editor__icon-btn no-hover-overlay"
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </HintTooltip>

          {showDictationActions ? (
            <>
              <HintTooltip content="Cancel dictation" side="bottom">
                <button
                  type="button"
                  onClick={() => void dictation.cancel()}
                  disabled={dictation.status === "stopping"}
                  aria-label="Cancel dictation"
                  className="user-msg-editor__icon-btn user-msg-editor__icon-btn--active no-hover-overlay"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </HintTooltip>
              <HintTooltip content="Keep dictated text" side="bottom">
                <button
                  type="button"
                  onClick={() => void dictation.submit()}
                  disabled={dictation.status === "stopping"}
                  aria-label="Keep dictated text"
                  className="user-msg-editor__icon-btn no-hover-overlay"
                >
                  <Check className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </HintTooltip>
            </>
          ) : (
            <HintTooltip
              content={dictationConnecting ? "Connecting…" : "Dictate"}
              side="bottom"
            >
              <button
                type="button"
                onClick={() => void dictation.start()}
                disabled={disabled || isSubmitting || dictationConnecting}
                aria-pressed={dictation.isActive}
                aria-busy={dictationConnecting || undefined}
                aria-label={
                  dictationConnecting ? "Connecting dictation" : "Dictate"
                }
                className="user-msg-editor__icon-btn no-hover-overlay"
              >
                {dictationConnecting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </HintTooltip>
          )}
          <span className="user-msg-editor__hint hidden sm:inline">
            Enter to save · Shift+Enter for new line
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
            title="Cancel (Esc)"
            className="user-msg-editor__cancel no-hover-overlay"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            title="Save and regenerate (Enter)"
            aria-label="Save edited message"
            className="user-msg-editor__save no-hover-overlay"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            )}
            <span>Save &amp; send</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={COMPOSER_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void ingestFiles(files);
        }}
      />

      <AttachmentPreviewHost
        file={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
