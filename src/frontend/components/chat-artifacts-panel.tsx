"use client";

import { Download, X } from "lucide-react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import {
  collectChatArtifacts,
  downloadArtifact,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";
import { ArtifactFileCard } from "@/frontend/components/agent/artifact-file-card";
import type { Message } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";

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
        "flex h-full w-full min-w-0 flex-col bg-white",
        "border-zinc-200 lg:h-full lg:min-h-0 lg:flex-1 lg:rounded-[18px] lg:border lg:border-zinc-200/80 lg:shadow-[0_12px_40px_-24px_rgba(24,24,27,0.14)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3.5">
        <h3 className="text-[15px] font-semibold text-zinc-900">Artifacts</h3>
        <div className="flex items-center gap-1">
          {artifacts.length > 1 ? (
            <button
              type="button"
              onClick={downloadAll}
              className="hidden h-8 items-center gap-1 rounded-[10px] border border-zinc-200 bg-white px-2.5 text-[11.5px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-50 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download all</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifacts panel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 lg:hidden"
          >
            <X className="icon-md" />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 pb-3">
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
