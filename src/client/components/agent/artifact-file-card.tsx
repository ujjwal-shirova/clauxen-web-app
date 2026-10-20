"use client";

import { useState } from "react";
import { Check, Code2, Copy, Download, Eye, FileText, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadArtifact, type ChatArtifact } from "@/lib/chat-artifacts";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
} from "@/lib/create-file-tags";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";

function formatArtifactSize(bytes?: number, content?: string): string | null {
  const count =
    typeof bytes === "number" && bytes > 0
      ? bytes
      : content
        ? new Blob([content]).size
        : undefined;
  if (!count) return null;
  if (count < 1024) return `${count} B`;
  return `${(count / 1024).toFixed(1)} KB`;
}

function ArtifactIcon({
  path,
  language,
  size = "md",
}: {
  path: string;
  language?: string;
  size?: "sm" | "md";
}) {
  const ext = path.split(".").pop()?.toLowerCase();
  const lang = language?.toLowerCase();
  const isHtml = ext === "html" || ext === "htm" || lang === "html";
  const isCode =
    !isHtml &&
    ext !== "md" &&
    ext !== "markdown" &&
    lang !== "markdown" &&
    lang !== "md";
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-lg";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  if (isHtml) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center border border-sky-200/90 bg-sky-50 text-sky-600 dark:border-sky-500/20 dark:bg-sky-950/40 dark:text-sky-400",
          box,
        )}
      >
        <Globe className={iconSize} strokeWidth={1.8} aria-hidden />
      </div>
    );
  }
  if (isCode) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center border border-emerald-200/90 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400",
          box,
        )}
      >
        <Code2 className={iconSize} strokeWidth={1.8} aria-hidden />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-zinc-200/90 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300",
        box,
      )}
    >
      <FileText className={iconSize} strokeWidth={1.8} aria-hidden />
    </div>
  );
}

export function ArtifactFileCard({
  artifact,
  className,
  variant = "message",
}: {
  artifact: ChatArtifact;
  className?: string;
  variant?: "message" | "panel";
}) {
  const viewer = useOptionalArtifactViewer();
  const [copied, setCopied] = useState(false);
  const title =
    artifact.description || artifact.fileName.replace(/\.[^.]+$/, "");
  const meta = artifactMetaLabel(artifact.path, artifact.language ?? "text");
  const sizeLabel = formatArtifactSize(artifact.sizeBytes, artifact.content);
  const isPanel = variant === "panel";
  const supportsPreview = artifactSupportsPreview(
    artifact.path,
    artifact.language,
  );

  const openFile = (forcedMode?: "preview" | "code") => {
    if (!artifact.content && artifact.fileId) {
      downloadArtifact(artifact);
      return;
    }
    const mode =
      forcedMode ?? (supportsPreview ? "preview" : "code");
    viewer?.openArtifact(artifact, mode);
  };

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!artifact.content) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation();
    downloadArtifact(artifact);
  };

  return (
    <div
      className={cn(
        "artifact-file-card group/file-card relative my-2 flex w-full min-w-0 items-center justify-between gap-2.5 rounded-xl border p-2 transition-all duration-150",
        "border-zinc-200/90 bg-white/95 shadow-[0_1px_3px_rgba(24,24,27,0.03)] backdrop-blur-sm",
        "hover:border-zinc-300 hover:shadow-[0_2px_6px_rgba(24,24,27,0.05)]",
        "dark:border-white/10 dark:bg-[#1b1b1e]/90 dark:shadow-none dark:hover:border-white/20",
        isPanel && "my-0 rounded-lg p-1.5",
        className,
      )}
    >
      {/* Clickable body */}
      <button
        type="button"
        onClick={() => openFile()}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
          isPanel && "gap-2",
        )}
        aria-label={`${artifact.content ? "Open in preview" : "Download"} ${title}`}
      >
        <ArtifactIcon
          path={artifact.path}
          language={artifact.language}
          size={isPanel ? "sm" : "md"}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-medium tracking-[-0.01em] text-zinc-900 dark:text-zinc-100",
              isPanel ? "text-[12.5px]" : "text-[13px]",
            )}
          >
            {title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-[430] text-zinc-500 dark:text-zinc-400">
            <span className="truncate">{meta}</span>
            {sizeLabel ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="shrink-0 tabular-nums">{sizeLabel}</span>
              </>
            ) : null}
          </div>
        </div>
      </button>

      {/* Action buttons designed for preview page interaction */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => openFile(supportsPreview ? "preview" : "code")}
          aria-label={supportsPreview ? `Preview ${title}` : `View ${title} code`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-all duration-150",
            "border-zinc-200/90 bg-zinc-50/90 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900",
            "dark:border-white/10 dark:bg-white/[0.08] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.12] dark:hover:text-white",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
            isPanel ? "h-6 px-2 text-[11px]" : "h-7",
          )}
        >
          {supportsPreview ? (
            <Eye className="size-3.5 shrink-0" strokeWidth={1.8} />
          ) : (
            <Code2 className="size-3.5 shrink-0" strokeWidth={1.8} />
          )}
          <span>{supportsPreview ? "Preview" : "Code"}</span>
        </button>

        {artifact.content ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied content" : `Copy ${title}`}
            title={copied ? "Copied!" : "Copy code"}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border transition-colors duration-150",
              "border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700",
              "dark:text-zinc-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-zinc-200",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
              isPanel ? "size-6" : "size-7",
            )}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="size-3.5" strokeWidth={1.8} />
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleDownload}
          aria-label={`Download ${title}`}
          title="Download file"
          className={cn(
            "inline-flex items-center justify-center rounded-lg border transition-colors duration-150",
            "border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700",
            "dark:text-zinc-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-zinc-200",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500",
            isPanel ? "size-6" : "size-7",
          )}
        >
          <Download className="size-3.5 shrink-0" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
