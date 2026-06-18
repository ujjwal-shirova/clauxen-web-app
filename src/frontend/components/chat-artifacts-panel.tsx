"use client";

import { Download, X } from "lucide-react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import {
  collectChatArtifacts,
  downloadArtifact,
  languageLabel,
  type ChatArtifact,
} from "@/frontend/lib/chat-artifacts";
import type { Message } from "@/frontend/lib/types";

type ChatArtifactsPanelProps = {
  onClose: () => void;
  messages: Message[];
};

function ArtifactRow({ artifact }: { artifact: ChatArtifact }) {
  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2.5">
      <div className="min-w-0 pr-2">
        <p className="truncate text-[14px] font-medium text-zinc-800">
          {artifact.fileName}
        </p>
        <p className="truncate text-[12px] text-zinc-500">
          {languageLabel(artifact.language)} · {artifact.path}
        </p>
      </div>
      <button
        type="button"
        onClick={() => downloadArtifact(artifact)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        aria-label={`Download ${artifact.fileName}`}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ChatArtifactsPanel({
  onClose,
  messages,
}: ChatArtifactsPanelProps) {
  const artifacts = collectChatArtifacts(messages);

  const downloadAll = () => {
    for (const artifact of artifacts) {
      downloadArtifact(artifact);
    }
  };

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-zinc-200 bg-white/95 backdrop-blur-md lg:w-[min(360px,34vw)] lg:shrink-0 lg:border-l">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <h3 className="text-[14px] font-medium text-zinc-800">
          Artifacts
          {artifacts.length > 0 ? (
            <span className="ml-1.5 text-zinc-400">({artifacts.length})</span>
          ) : null}
        </h3>
        <div className="flex items-center gap-1">
          {artifacts.length > 1 ? (
            <button
              type="button"
              onClick={downloadAll}
              className="hidden h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download all</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifacts panel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            <X className="icon-md" />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {artifacts.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] leading-5 text-zinc-500">
              Files created during agent work will appear here with download
              actions.
            </p>
          ) : (
            artifacts.map((artifact) => (
              <ArtifactRow key={artifact.id} artifact={artifact} />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
