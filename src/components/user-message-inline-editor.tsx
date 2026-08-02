"use client";

import * as React from "react";
import { ArrowUp, LoaderCircle, Mic, Plus, X } from "lucide-react";
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

const MAX_EDIT_LINES = 8;
const EDIT_LINE_HEIGHT_PX = 22;

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
  const canSubmit = Boolean(value.trim()) || attachments.length > 0;

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const next = Math.min(
      Math.max(textarea.scrollHeight, EDIT_LINE_HEIGHT_PX),
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
    // preventScroll: focusing a sticky host must not fight chat scroll /
    // sticky release (browser scrollIntoView keeps the edit box pinned).
    textarea.focus({ preventScroll: true });
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
  }, [messageId]);

  React.useEffect(() => {
    return () => {
      for (const item of attachments) {
        if (item.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    };
    // Only on unmount — intentional.
  }, []);

  const maybeCancelIfEmpty = React.useCallback(
    (nextValue: string, nextAttachments: ComposerAttachment[]) => {
      if (nextValue.trim() || nextAttachments.length > 0) return;
      onCancel();
    },
    [onCancel],
  );

  const handleValueChange = (next: string) => {
    onValueChange(next);
    maybeCancelIfEmpty(next, attachments);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl?.startsWith("blob:") && !target.fileId) {
        // Only revoke freshly added local blobs, not remote URLs.
        if (target.file) URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((item) => item.id !== id);
      queueMicrotask(() => maybeCancelIfEmpty(value, next));
      return next;
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

  const handleSubmit = async () => {
    if (disabled || isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        value,
        attachments.map((item) => ({ ...item })),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="user-message-card__body user-message-card__body--editing no-hover-overlay w-full rounded-xl px-3 py-2.5 text-left sm:px-4 sm:py-3"
      data-user-message-editing={messageId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
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
        onChange={(event) => handleValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        rows={1}
        placeholder="Edit message…"
        className={cn(
          "w-full resize-none bg-transparent text-[13.5px] font-[430] leading-[1.55] text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-[14px] sm:leading-[1.58]",
          "max-h-[176px]",
        )}
        style={{ lineHeight: `${EDIT_LINE_HEIGHT_PX}px` }}
        aria-label="Edit user message"
      />

      {attachmentError ? (
        <p className="mt-1 text-[11px] text-red-600">{attachmentError}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-1.5">
        <HintTooltip content="Add files">
          <button
            type="button"
            aria-label="Add files"
            disabled={disabled || isSubmitting}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </HintTooltip>

        <div className="min-w-0 flex-1" />

        {isDictating ? (
          <HintTooltip content="Stop dictation">
            <button
              type="button"
              onClick={() => void startDictation()}
              aria-label="Stop dictation"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          </HintTooltip>
        ) : (
          <HintTooltip content="Dictate">
            <button
              type="button"
              onClick={() => void startDictation()}
              disabled={disabled || isSubmitting || isTranscribing}
              aria-pressed={isDictating}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
            >
              {isTranscribing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4 opacity-80" />
              )}
            </button>
          </HintTooltip>
        )}

        <HintTooltip content="Send">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || disabled || isSubmitting}
            aria-label="Send edited message"
            className={cn(
              "no-hover-overlay flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition-all",
              (!canSubmit || disabled || isSubmitting) &&
                "cursor-not-allowed opacity-40",
            )}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </HintTooltip>
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
