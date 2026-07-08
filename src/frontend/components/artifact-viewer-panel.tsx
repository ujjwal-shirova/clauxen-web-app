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
  inferLanguageFromPath,
} from "@/frontend/lib/create-file-tags";
import {
  downloadArtifact,
  fileNameFromPath,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";
import {
  useArtifactViewer,
  type ArtifactViewMode,
} from "@/frontend/contexts/artifact-viewer-context";

function artifactExtensionLabel(path: string, language?: string): string {
  const ext = path.split(".").pop()?.trim();
  return (ext || language || "file").toUpperCase();
}

function isPrintableArtifact(path: string, language?: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  const normalized = language?.toLowerCase();
  return (
    ext === "md" ||
    ext === "markdown" ||
    ext === "txt" ||
    normalized === "markdown" ||
    normalized === "text"
  );
}

function ViewModeButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
        active
          ? "border-zinc-300 bg-white text-zinc-900 shadow-sm"
          : "border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
      )}
    >
      {children}
    </button>
  );
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
  const isMarkdown =
    language === "markdown" || artifact.path.toLowerCase().endsWith(".md");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ViewModeButton
            active={viewMode === "preview"}
            onClick={() => setViewMode("preview")}
            label="Preview"
          >
            <Eye className="h-4 w-4" strokeWidth={1.75} />
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === "code"}
            onClick={() => setViewMode("code")}
            label="Code"
          >
            <Code2 className="h-4 w-4" strokeWidth={1.75} />
          </ViewModeButton>
          <div className="ml-1 min-w-0 truncate text-[13px] font-medium text-zinc-800">
            {title}
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="text-zinc-500">{meta.split(" · ")[1]}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
        {viewMode === "preview" && isMarkdown ? (
          <div className="artifact-preview-markdown px-6 py-6 sm:px-8 sm:py-8">
            <MarkdownRenderer content={artifact.content} />
          </div>
        ) : viewMode === "preview" ? (
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.6] text-zinc-800">
              {artifact.content}
            </pre>
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
