"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  Share,
  X,
} from "@/components/ui/bootstrap-icon";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { HighlightCode } from "@/lib/syntax-highlight";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/lib/create-file-tags";
import {
  downloadArtifact,
  fileNameFromPath,
  shareArtifact,
  type ChatArtifact,
} from "@/lib/chat-artifacts";
import { useArtifactViewer } from "@/contexts/artifact-viewer-context";

function artifactExtensionLabel(path: string, language?: string): string {
  const ext = path.split(".").pop()?.trim();
  return (ext || language || "file").toUpperCase();
}

function isPrintableArtifact(path: string, language?: string): boolean {
  return artifactSupportsPreview(path, language);
}

function CopyMenu({
  artifact,
  onCopy,
  copied,
}: {
  artifact: ChatArtifact;
  onCopy: () => void;
  copied: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const extensionLabel = artifactExtensionLabel(
    artifact.path,
    artifact.language,
  );
  const canPrint = isPrintableArtifact(artifact.path, artifact.language);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)] dark:border-white/10 dark:bg-[#202023]">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
        <button
          type="button"
          aria-label="More copy options"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center border-l border-zinc-200/90 px-1.5 py-1 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[176px] overflow-hidden rounded-xl border border-zinc-200/90 bg-white p-1 shadow-[0_12px_32px_-16px_rgba(24,24,27,0.28)] dark:border-white/10 dark:bg-[#202023] dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            className="flex w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
            onClick={() => {
              downloadArtifact(artifact);
              setOpen(false);
            }}
          >
            Download as {extensionLabel}
          </button>
          {canPrint ? (
            <button
              type="button"
              className="flex w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
              onClick={() => {
                window.print();
                setOpen(false);
              }}
            >
              Print as PDF
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ArtifactViewerPanel({
  artifact,
  onClose,
}: {
  artifact: ChatArtifact;
  onClose: () => void;
}) {
  const { viewMode, setViewMode } = useArtifactViewer();
  const [copied, setCopied] = useState(false);
  const language =
    artifact.language ?? inferLanguageFromPath(artifact.path);
  const title =
    artifact.description ||
    fileNameFromPath(artifact.path).replace(/\.[^.]+$/, "");
  const meta = artifactMetaLabel(artifact.path, language);
  const supportsPreview = artifactSupportsPreview(artifact.path, language);
  const effectiveViewMode = supportsPreview ? viewMode : "code";

  const ext = artifact.path.split(".").pop()?.toLowerCase();
  const normalizedLang = language?.toLowerCase();
  const isHtml = ext === "html" || ext === "htm" || normalizedLang === "html";
  const isSvg = ext === "svg" || normalizedLang === "svg";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      className="artifact-viewer-panel flex h-full w-full min-w-0 flex-col bg-white dark:bg-[#18181b]"
      aria-label={`File viewer: ${title}`}
    >
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-200/80 px-3.5 py-2.5 sm:px-4.5 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
              <FileText
                className="size-4 text-zinc-500 dark:text-zinc-400"
                strokeWidth={1.8}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
              <p className="truncate text-[11.5px] font-[430] text-zinc-500 dark:text-zinc-400">
                {meta}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void shareArtifact(artifact)}
              aria-label={`Share ${title}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 text-[11.5px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            >
              <Share className="h-3 w-3" strokeWidth={1.9} />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              type="button"
              onClick={() => downloadArtifact(artifact)}
              aria-label={`Download ${title}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 text-[11.5px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            >
              <Download className="h-3 w-3" strokeWidth={1.9} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              aria-label="Close file viewer"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              <X className="size-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {supportsPreview ? (
            <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200/90 bg-zinc-100/80 p-0.5 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                aria-pressed={effectiveViewMode === "preview"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  effectiveViewMode === "preview"
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.06)] dark:bg-white/15 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("code")}
                aria-pressed={effectiveViewMode === "code"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  effectiveViewMode === "code"
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.06)] dark:bg-white/15 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                )}
              >
                <Code2 className="h-3.5 w-3.5" />
                Code
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-2.5 py-1 text-[11.5px] font-medium text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Code2 className="h-3.5 w-3.5" />
              Code
            </div>
          )}
          <CopyMenu artifact={artifact} onCopy={handleCopy} copied={copied} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#fafafa_0%,#ffffff_48px)] dark:bg-[linear-gradient(180deg,#18181b_0%,#18181b_48px)]">
        {effectiveViewMode === "preview" && supportsPreview ? (
          isHtml ? (
            <div className="relative h-full w-full bg-white dark:bg-[#18181b]">
              <iframe
                srcDoc={artifact.content}
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                className="h-full w-full border-0 bg-white"
                title={`Preview of ${title}`}
              />
            </div>
          ) : isSvg ? (
            <div className="flex h-full w-full items-center justify-center p-8 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]">
              <div
                className="max-h-full max-w-full overflow-auto rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#202024]"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: artifact.content }}
              />
            </div>
          ) : (
            <div className="artifact-preview-markdown mx-auto max-w-4xl px-5 py-5 sm:px-8 sm:py-7">
              <MarkdownRenderer content={artifact.content} />
            </div>
          )
        ) : (
          <div className="h-full min-h-0 bg-zinc-50 dark:bg-[#151518]">
            <HighlightCode
              code={artifact.content}
              language={language}
              showLineNumbers
            />
          </div>
        )}
      </div>
    </aside>
  );
}

export function ArtifactLibrary({
  artifacts,
  onOpen,
  onClose,
}: {
  artifacts: ChatArtifact[];
  onOpen: (artifact: ChatArtifact) => void;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-white dark:bg-[#18181b]" aria-label="Artifacts">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
            Artifacts
          </h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            {artifacts.length} file{artifacts.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close artifacts"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {artifacts.map((artifact) => (
          <li key={artifact.id} className="flex items-center gap-1 rounded-xl px-1 py-1 hover:bg-zinc-50 dark:hover:bg-white/5">
            <button
              type="button"
              onClick={() => onOpen(artifact)}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
            >
              <FileText className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {artifact.fileName}
                </span>
                <span className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400">
                  {artifactMetaLabel(artifact.path, artifact.language ?? "text")}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Share ${artifact.fileName}`}
              onClick={() => void shareArtifact(artifact)}
              className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              <Share className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Download ${artifact.fileName}`}
              onClick={() => downloadArtifact(artifact)}
              className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              <Download className="size-4" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
