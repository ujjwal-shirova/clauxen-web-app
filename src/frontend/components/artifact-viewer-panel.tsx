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
  X,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { HighlightCode } from "@/frontend/lib/syntax-highlight";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
  inferLanguageFromPath,
} from "@/frontend/lib/create-file-tags";
import {
  downloadArtifact,
  fileNameFromPath,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";
import { useArtifactViewer } from "@/frontend/contexts/artifact-viewer-context";

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
      <div className="inline-flex overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)]">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          aria-label="More copy options"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center border-l border-zinc-200/90 px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[176px] overflow-hidden rounded-[12px] border border-zinc-200/90 bg-white p-1 shadow-[0_12px_32px_-16px_rgba(24,24,27,0.28)]">
          <button
            type="button"
            className="flex w-full rounded-[8px] px-3 py-2 text-left text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100"
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
              className="flex w-full rounded-[8px] px-3 py-2 text-left text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100"
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
  const extension = artifactExtensionLabel(artifact.path, language);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      className="artifact-viewer-panel flex h-full w-full min-w-0 flex-col bg-white"
      aria-label={`File viewer: ${title}`}
    >
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-zinc-200/80 px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-zinc-200/90 bg-zinc-50">
              <FileText
                className="h-4 w-4 text-zinc-500"
                strokeWidth={1.7}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
                {title}
              </h2>
              <p className="mt-0.5 truncate text-[12px] font-[430] text-zinc-500">
                {meta}
                <span className="mx-1.5 text-zinc-300">·</span>
                {extension}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => downloadArtifact(artifact)}
              aria-label={`Download ${title}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-zinc-200/90 bg-white px-2.5 text-[12px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              aria-label="Close file viewer"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {supportsPreview ? (
            <div className="inline-flex overflow-hidden rounded-[10px] border border-zinc-200/90 bg-zinc-50/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                aria-pressed={effectiveViewMode === "preview"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  effectiveViewMode === "preview"
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                    : "text-zinc-500 hover:text-zinc-800",
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
                  "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  effectiveViewMode === "code"
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                    : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                <Code2 className="h-3.5 w-3.5" />
                Code
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-[10px] border border-zinc-200/80 bg-zinc-50 px-2.5 py-1.5 text-[12px] font-medium text-zinc-600">
              <Code2 className="h-3.5 w-3.5" />
              Code
            </div>
          )}
          <CopyMenu artifact={artifact} onCopy={handleCopy} copied={copied} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#fafafa_0%,#ffffff_48px)]">
        {effectiveViewMode === "preview" && supportsPreview ? (
          <div className="artifact-preview-markdown px-5 py-5 sm:px-7 sm:py-7">
            <MarkdownRenderer content={artifact.content} />
          </div>
        ) : (
          <div className="h-full min-h-0">
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
