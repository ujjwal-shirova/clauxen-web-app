"use client";

import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadArtifact, type ChatArtifact } from "@/lib/chat-artifacts";
import {
  artifactMetaLabel,
  artifactSupportsPreview,
} from "@/lib/create-file-tags";
import { useOptionalArtifactViewer } from "@/contexts/artifact-viewer-context";

function DocumentStackIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-md";
  const icon = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-zinc-200/90 bg-white",
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
  const meta = artifactMetaLabel(artifact.path, artifact.language ?? "text");
  const isPanel = variant === "panel";

  const openFile = () => {
    if (!artifact.content && artifact.fileId) {
      downloadArtifact(artifact);
      return;
    }
    const mode = artifactSupportsPreview(artifact.path, artifact.language)
      ? "preview"
      : "code";
    viewer?.openArtifact(artifact, mode);
  };

  return (
    <div
      className={cn(
        "artifact-file-card relative my-3 flex w-full min-w-0 items-stretch gap-1.5 rounded-xl border border-black/[0.10] bg-[#fcfcfb] p-1.5 shadow-[0_1px_2px_rgba(28,25,23,0.035)]",
        isPanel && "my-0 rounded-xl p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={openFile}
        className={cn(
          "artifact-file-card__body group/file-body no-hover-overlay flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-transparent px-2.5 py-2 text-left transition-colors duration-150",
          "hover:bg-black/[0.035]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
          isPanel && "gap-2 rounded-md px-2 py-1.5",
        )}
        aria-label={`${artifact.content ? "Open" : "Download"} ${title}`}
      >
        <DocumentStackIcon size={isPanel ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-medium tracking-[-0.01em] text-zinc-900",
              isPanel ? "text-[13px]" : "text-[13px]",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] font-[430] text-zinc-500">
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
          "no-hover-overlay inline-flex shrink-0 items-center justify-center gap-1.5 self-center rounded-md border border-zinc-200/90 bg-white text-zinc-700 transition-colors duration-150",
          "hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
          isPanel ? "h-7 w-7" : "h-7 px-2.5 text-[12px] font-medium",
        )}
      >
        <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
        {isPanel ? null : <span>Download</span>}
      </button>
    </div>
  );
}
