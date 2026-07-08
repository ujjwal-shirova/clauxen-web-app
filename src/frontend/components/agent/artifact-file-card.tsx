"use client";

import { Download, FileText } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";
import { artifactMetaLabel, artifactSupportsPreview } from "@/frontend/lib/create-file-tags";
import { downloadArtifact } from "@/frontend/lib/chat-artifacts";
import { useOptionalArtifactViewer } from "@/frontend/contexts/artifact-viewer-context";

function DocumentStackIcon() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-zinc-200/90 bg-white">
      <FileText
        className="h-[22px] w-[22px] text-zinc-500"
        strokeWidth={1.6}
        aria-hidden
      />
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
  const title =
    artifact.description || artifact.fileName.replace(/\.[^.]+$/, "");
  const meta = artifactMetaLabel(
    artifact.path,
    artifact.language ?? "text",
  );
  const isPanel = variant === "panel";

  const openFile = () => {
    const mode = artifactSupportsPreview(artifact.path, artifact.language)
      ? "preview"
      : "code";
    viewer?.openArtifact(artifact, mode);
  };

  if (isPanel) {
    return (
      <div
        className={cn(
          "my-0 flex w-full min-w-0 items-stretch gap-1.5 rounded-[12px] border border-zinc-200/80 bg-white p-1.5",
          className,
        )}
      >
        <button
          type="button"
          onClick={openFile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200/80"
        >
          <DocumentStackIcon />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-zinc-900">
              {title}
            </p>
            <p className="truncate text-[12px] text-zinc-500">{meta}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            downloadArtifact(artifact);
          }}
          aria-label={`Download ${title}`}
          className="inline-flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-800"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "my-3 flex w-full min-w-0 items-center gap-3 rounded-[12px] border border-zinc-200/80 bg-white px-3 py-2.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={openFile}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <DocumentStackIcon />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-zinc-900">
            {title}
          </p>
          <p className="truncate text-[12px] text-zinc-500">{meta}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          downloadArtifact(artifact);
        }}
        aria-label={`Download ${title}`}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-800"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}
