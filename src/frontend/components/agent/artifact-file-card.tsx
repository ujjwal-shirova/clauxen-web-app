"use client";

import { Download, FileText } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { ChatArtifact } from "@/frontend/lib/chat-artifacts";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
} from "@/frontend/lib/create-file-tags";
import { downloadArtifact } from "@/frontend/lib/chat-artifacts";
import { useOptionalArtifactViewer } from "@/frontend/contexts/artifact-viewer-context";

function DocumentStackIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9 rounded-[9px]" : "h-10 w-10 rounded-[10px]";
  const icon = size === "sm" ? "h-[18px] w-[18px]" : "h-[20px] w-[20px]";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-zinc-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        box,
      )}
    >
      <FileText
        className={cn("text-zinc-500", icon)}
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

  return (
    <div
      className={cn(
        "artifact-file-card group/file relative my-3 flex w-full min-w-0 items-stretch gap-2 rounded-[14px] border border-zinc-200/85 bg-white p-1.5 transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out",
        "hover:border-zinc-300/90 hover:bg-zinc-50/40 hover:shadow-[0_8px_24px_-14px_rgba(24,24,27,0.22)]",
        "focus-within:border-zinc-300/90 focus-within:shadow-[0_8px_24px_-14px_rgba(24,24,27,0.18)]",
        isPanel && "my-0 rounded-[12px] p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={openFile}
        className={cn(
          "artifact-file-card__body no-hover-overlay flex min-w-0 flex-1 items-center gap-3 rounded-[10px] bg-zinc-50/90 px-2.5 py-2 text-left transition-colors duration-200",
          "group-hover/file:bg-zinc-100/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200/90",
          isPanel && "gap-2.5 rounded-[9px] px-2 py-1.5",
        )}
        aria-label={`Open ${title}`}
      >
        <DocumentStackIcon size={isPanel ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold tracking-[-0.01em] text-zinc-900",
              isPanel ? "text-[13.5px]" : "text-[14px]",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-[430] text-zinc-500">
            {meta}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          downloadArtifact(artifact);
        }}
        aria-label={`Download ${title}`}
        className={cn(
          "no-hover-overlay inline-flex shrink-0 items-center justify-center gap-1.5 self-center rounded-[10px] border border-zinc-200/90 bg-white text-zinc-700 transition-[border-color,background-color,color,box-shadow] duration-200",
          "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 hover:shadow-[0_1px_2px_rgba(24,24,27,0.06)]",
          "active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200/90",
          isPanel
            ? "h-8 w-8"
            : "h-9 px-3 text-[12px] font-semibold",
        )}
      >
        <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
        {isPanel ? null : <span>Download</span>}
      </button>
    </div>
  );
}
