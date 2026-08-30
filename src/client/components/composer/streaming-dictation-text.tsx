"use client";

import { useEffect, useMemo, useRef } from "react";
import type { DictationStatus } from "@/features/dictation/types";

type StreamingDictationTextProps = {
  text: string;
  status: DictationStatus;
};

/** Match the textarea exactly so typing and dictation never change text scale. */
const DICTATION_LINE =
  "min-h-[var(--prompt-editor-min-height,24px)] text-[16px] font-[430] leading-[24px]";

export function StreamingDictationText({
  text,
  status: _status,
}: StreamingDictationTextProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => text.split(/(\s+)/), [text]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [text]);

  // Connecting state stays on the mic button spinner — composer only shows
  // Listening once the dictation surface is active.
  if (!text) {
    return (
      <div
        className={`flex items-center text-zinc-500 ${DICTATION_LINE}`}
        aria-live="polite"
      >
        <span className="truncate">Listening…</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="textbox"
      aria-label="Live dictation transcript"
      aria-multiline="true"
      aria-live="polite"
      className={`max-h-[147px] overflow-y-auto py-0 text-zinc-800 [scrollbar-width:thin] ${DICTATION_LINE}`}
    >
      {parts.map((part, index) =>
        /^\s+$/.test(part) ? (
          part
        ) : (
          <span key={`${index}-${part}`}>
            {part}
          </span>
        ),
      )}
    </div>
  );
}
