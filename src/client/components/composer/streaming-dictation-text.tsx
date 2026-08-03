"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { DictationStatus } from "@/features/dictation/types";

type StreamingDictationTextProps = {
  text: string;
  status: DictationStatus;
};

/** Match prompt composer single-line metrics — never inflate height just for listening. */
const DICTATION_LINE =
  "min-h-[var(--prompt-editor-min-height,22px)] text-[13px] font-[430] leading-[18px]";

export function StreamingDictationText({
  text,
  status: _status,
}: StreamingDictationTextProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
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
          <motion.span
            key={`${index}-${part}`}
            initial={reduceMotion ? false : { opacity: 0, filter: "blur(5px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {part}
          </motion.span>
        ),
      )}
    </div>
  );
}
