"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/frontend/lib/utils";

type FastStreamingTextProps = {
  content: string;
  className?: string;
};

/**
 * Low-latency streaming text: committed body renders immediately; only the
 * latest delta gets a short opacity fade (no markdown parse, no per-word spans).
 */
export function FastStreamingText({ content, className }: FastStreamingTextProps) {
  const baseRef = useRef("");

  let base = baseRef.current;
  let tail = "";

  if (!content) {
    base = "";
    tail = "";
  } else if (content.length < base.length || !content.startsWith(base)) {
    base = content;
    tail = "";
    baseRef.current = content;
  } else if (content.length > base.length) {
    tail = content.slice(base.length);
  } else {
    base = content;
  }

  useLayoutEffect(() => {
    baseRef.current = content;
  }, [content]);

  return (
    <span
      className={cn(
        "whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-800",
        className,
      )}
    >
      <span>{base}</span>
      {tail ? (
        <span key={`${content.length}-${tail.length}`} className="stream-tail-fade">
          {tail}
        </span>
      ) : null}
    </span>
  );
}
