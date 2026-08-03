"use client";

import { Download, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  collectChatArtifacts,
  downloadArtifact,
  type ChatArtifact,
} from "@/lib/chat-artifacts";
import { ArtifactFileCard } from "@/components/agent/artifact-file-card";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatArtifactsPanelProps = {
  onClose: () => void;
  messages: Message[];
  className?: string;
};

export function ChatArtifactsPanel({
  onClose,
  messages,
  className,
}: ChatArtifactsPanelProps) {
  const artifacts = collectChatArtifacts(messages);

  const downloadAll = () => {
    for (const artifact of artifacts) {
      downloadArtifact(artifact);
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full w-full min-w-0 flex-col bg-[var(--app-panel-bg)]",
        "border-zinc-200/80 lg:h-full lg:min-h-0 lg:flex-1 lg:rounded-xl lg:border",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 px-3 py-2.5">
        <h3 className="text-[13px] font-medium tracking-[-0.01em] text-zinc-800">
          Artifacts
          {artifacts.length > 0 ? (
            <span className="ml-1 text-zinc-400">({artifacts.length})</span>
          ) : null}
        </h3>
        <div className="flex items-center gap-1">
          {artifacts.length > 1 ? (
            <button
              type="button"
              onClick={downloadAll}
              className="hidden h-7 items-center gap-1 rounded-md border border-zinc-200/90 bg-white px-2 text-[11.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download all</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifacts panel"
            className="ui-icon-button text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800 lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 p-2.5">
          {artifacts.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] leading-5 text-zinc-500">
              Files created during agent work will appear here.
            </p>
          ) : (
            artifacts.map((artifact: ChatArtifact) => (
              <ArtifactFileCard
                key={artifact.id}
                artifact={artifact}
                variant="panel"
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
