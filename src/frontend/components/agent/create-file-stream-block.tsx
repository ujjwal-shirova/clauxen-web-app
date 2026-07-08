"use client";

import { useEffect, useRef } from "react";
import { FileCode, LoaderCircle } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { CreateFileBlock } from "@/frontend/lib/create-file-tags";
import { artifactMetaLabel } from "@/frontend/lib/create-file-tags";
import { StreamingTextFade } from "@/frontend/lib/streaming-text-fade";
import { HighlightCode } from "@/frontend/lib/syntax-highlight";

export function CreateFileStreamBlock({
  block,
  streamKey,
}: {
  block: CreateFileBlock;
  streamKey: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = !block.isComplete;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [block.content, isStreaming]);

  return (
    <div className="my-3 w-full min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-violet-200/80 bg-violet-50 text-violet-600">
          <FileCode className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13px] font-semibold text-zinc-800",
              isStreaming && "shimmer-text",
            )}
          >
            {isStreaming ? `Creating ${block.title}` : block.title}
          </p>
          <p className="truncate text-[11.5px] text-zinc-400">
            {artifactMetaLabel(block.path, block.language)}
          </p>
        </div>
        {isStreaming ? (
          <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-zinc-200/90 bg-[#faf9f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div
          ref={scrollRef}
          className="create-file-stream-scroll max-h-[16rem] overflow-y-auto px-3 py-2.5"
        >
          {isStreaming ? (
            <StreamingTextFade
              content={block.content}
              streamKey={`${streamKey}-${block.id}`}
              className="whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.55] text-zinc-700"
            />
          ) : (
            <HighlightCode
              code={block.content}
              language={block.language}
              showLineNumbers={false}
              className="!p-0 !text-[12px]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
