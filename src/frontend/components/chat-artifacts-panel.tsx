"use client";

import { X } from "lucide-react";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";

const PLACEHOLDER_ARTIFACTS = [
  "Gitee dataset metadata",
  "Jihulab dataset documentation",
  "Notabug dataset documentation",
  "Gitflic dataset documentation",
  "Gitverse dataset documentation",
];

type ChatArtifactsPanelProps = {
  onClose: () => void;
};

export function ChatArtifactsPanel({ onClose }: ChatArtifactsPanelProps) {
  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-zinc-200 bg-white/95 backdrop-blur-md lg:w-[min(360px,34vw)] lg:shrink-0 lg:border-l">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <h3 className="text-[14px] font-medium text-zinc-800">Artifacts</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="hidden h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-[430] text-zinc-800 transition-colors hover:bg-zinc-100 sm:inline-flex"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              fill="currentColor"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
            </svg>
            <span>Download all</span>
          </button>
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
          {PLACEHOLDER_ARTIFACTS.map((item) => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white/80 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
            >
              <div className="min-w-0 pr-2">
                <p className="truncate text-[14px] text-zinc-800">{item}</p>
                <p className="text-[12px] text-zinc-500">Document · MD</p>
              </div>
              <span className="shrink-0 text-zinc-500">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M16.5 13a.5.5 0 0 1 .5.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-2a.5.5 0 0 1 1 0v2a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 .5-.5M10 3a.5.5 0 0 1 .5.5v8.686l3.126-3.518a.5.5 0 0 1 .748.664l-4 4.5-.08.071a.5.5 0 0 1-.668-.071l-4-4.5-.059-.082A.5.5 0 0 1 6.3 8.6l.075.068L9.5 12.186V3.5A.5.5 0 0 1 10 3" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
