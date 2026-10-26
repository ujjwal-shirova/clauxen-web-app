"use client";

import { useEffect, useRef } from "react";
import { FileCode, LoaderCircle } from "@/components/ui/bootstrap-icon";
import { cn } from "@/lib/utils";
import type { CreateFileBlock } from "@/lib/create-file-tags";
import { artifactMetaLabel } from "@/lib/create-file-tags";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { HighlightCode } from "@/lib/syntax-highlight";

export function CreateFileStreamBlock({
  block,
  streamKey,
  compact = false,
}: {
  block: CreateFileBlock;
  streamKey: string;
  /** Hide the outer file header — used inside the agent timeline step. */
  compact?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = !block.isComplete;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [block.content, isStreaming]);

  return (
    <div className={cn("w-full min-w-0", !compact && "my-2.5")}>
      {!compact ? (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200/90 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">
            <FileCode className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100",
                isStreaming && "shimmer-text",
              )}
              data-shimmer-active={isStreaming || undefined}
            >
              {isStreaming ? `Creating ${block.title}…` : block.title}
            </p>
            <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
              {artifactMetaLabel(block.path, block.language)}
            </p>
          </div>
          {isStreaming ? (
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" />
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:bg-[#161619] dark:shadow-none">
        <div
          ref={scrollRef}
          className="create-file-stream-scroll max-h-[16rem] overflow-x-auto overflow-y-auto px-3 py-2.5 [overscroll-behavior-x:contain] [overscroll-behavior-y:contain]"
        >
          {isStreaming ? (
            <StreamingTextFade
              content={block.content}
              streamKey={`${streamKey}-${block.id}`}
              className="whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.55] text-zinc-700 dark:text-zinc-300"
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
