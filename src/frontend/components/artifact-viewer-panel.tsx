"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eye,
  Maximize2,
  RefreshCw,
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
      <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
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
          className="inline-flex items-center border-l border-zinc-200 px-2 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] overflow-hidden rounded-[14px] border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_-16px_rgba(24,24,27,0.35)]">
          <button
            type="button"
            className="flex w-full rounded-lg px-3 py-2.5 text-left text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100"
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
              className="flex w-full rounded-lg px-3 py-2.5 text-left text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100"
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="ml-1 min-w-0 truncate text-[13px] font-medium text-zinc-800">
            {title}
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="text-zinc-500">{meta.split(" · ")[1]}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {supportsPreview ? (
            <div className="mr-0.5 inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                aria-pressed={effectiveViewMode === "preview"}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  effectiveViewMode === "preview"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
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
                  "inline-flex items-center gap-1.5 border-l border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  effectiveViewMode === "code"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
                )}
              >
                <Code2 className="h-3.5 w-3.5" />
                Code
              </button>
            </div>
          ) : null}
          <CopyMenu artifact={artifact} onCopy={handleCopy} copied={copied} />
          <button
            type="button"
            aria-label="Refresh"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Expand"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Close artifact viewer"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {effectiveViewMode === "preview" && supportsPreview ? (
          <div className="artifact-preview-markdown px-6 py-6 sm:px-8 sm:py-8">
            <MarkdownRenderer content={artifact.content} />
          </div>
        ) : (
          <div className="h-full min-h-0 bg-zinc-50/40">
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
