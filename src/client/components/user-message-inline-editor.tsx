"use client";

import * as React from "react";
import { Check, LoaderCircle, Mic, Paperclip, X } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { AttachmentChip } from "@/components/composer/attachment-chip";
import { AttachmentImageLightbox } from "@/components/composer/attachment-image-lightbox";
import { AttachmentDocumentPreview } from "@/components/composer/attachment-document-preview";
import {
  COMPOSER_FILE_ACCEPT,
  classifyComposerFile,
  readTextPreview,
  type ComposerAttachment,
  type MessageAttachment,
} from "@/lib/composer-attachments";
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
  const [attachments, setAttachments] = React.useState<ComposerAttachment[]>(
    () => messageToComposerAttachments(initialAttachments),
  );
  const [attachmentError, setAttachmentError] = React.useState<string | null>(
    null,
  );
  const [previewAttachment, setPreviewAttachment] =
    React.useState<ComposerAttachment | null>(null);
  const [isDictating, setIsDictating] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const maxHeightPx = MAX_EDIT_LINES * EDIT_LINE_HEIGHT_PX;
  const trimmed = value.trim();
  const canSubmit =
    (Boolean(trimmed) || attachments.length > 0) &&
    !disabled &&
    !isSubmitting;

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
      for (const item of attachments) {
        if (item.previewUrl?.startsWith("blob:") && item.file) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // noop
        }
      }
    };
    // Only on unmount — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (kind === "image") {
        next.push({
          id,
          name: file.name,
          previewUrl,
          mimeType: file.type || "image/png",
          kind: "image",
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

  const releaseRecording = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startDictation = async () => {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      return;
    }
    if (isDictating) {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        releaseRecording();
        setIsDictating(false);
        if (audio.size === 0) return;
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
          if (!transcript) return;
          const previous = value;
          const next =
            previous && !/\s$/.test(previous)
              ? `${previous} ${transcript}`
              : `${previous}${transcript}`;
          onValueChange(next);
        } catch {
          // Transcription is best-effort.
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start(100);
      setIsDictating(true);
    } catch {
      setIsDictating(false);
      releaseRecording();
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        value,
        attachments.map((item) => ({ ...item })),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, value, attachments, onSubmit]);

  return (
    <div
      className="user-msg-editor no-hover-overlay w-full text-left"
      data-user-message-editing={messageId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
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
            isDictating && "user-msg-editor__rec--live",
          )}
          aria-hidden={!isDictating}
        >
          {isDictating ? "Recording…" : ""}
        </span>
      </div>

      {attachments.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              file={attachment}
              size="lg"
              onRemove={() => removeAttachment(attachment.id)}
              onOpen={() => setPreviewAttachment(attachment)}
            />
          ))}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled || isSubmitting}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        rows={2}
        placeholder="Edit your message…"
        className="user-msg-editor__input w-full resize-none bg-transparent outline-none"
        style={{
          lineHeight: `${EDIT_LINE_HEIGHT_PX}px`,
          maxHeight: `${maxHeightPx}px`,
        }}
        aria-label="Edit user message"
      />

      {attachmentError ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--settings-danger)]">
          {attachmentError}
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
              className="user-msg-editor__icon-btn"
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </HintTooltip>

          {isDictating ? (
            <HintTooltip content="Stop dictation" side="bottom">
              <button
                type="button"
                onClick={() => void startDictation()}
                aria-label="Stop dictation"
                className="user-msg-editor__icon-btn user-msg-editor__icon-btn--active"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </HintTooltip>
          ) : (
            <HintTooltip content="Dictate" side="bottom">
              <button
                type="button"
                onClick={() => void startDictation()}
                disabled={disabled || isSubmitting || isTranscribing}
                aria-pressed={isDictating}
                aria-label="Dictate"
                className="user-msg-editor__icon-btn"
              >
                {isTranscribing ? (
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
            className="user-msg-editor__cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            title="Save and regenerate (Enter)"
            aria-label="Save edited message"
            className="user-msg-editor__save"
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
    </div>
  );
}
