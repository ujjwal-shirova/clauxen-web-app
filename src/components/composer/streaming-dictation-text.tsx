"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import type { DictationStatus } from "@/features/dictation/types";

type StreamingDictationTextProps = {
  text: string;
  status: DictationStatus;
};

export function StreamingDictationText({
  text,
  status,
}: StreamingDictationTextProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const parts = useMemo(() => text.split(/(\s+)/), [text]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [text]);

  if (!text) {
    return (
      <div className="flex min-h-9 items-center gap-2 text-[13px] text-zinc-500">
        <LoaderCircle className="icon-md animate-spin" />
        <span>
          {status === "connecting" ? "Connecting dictation…" : "Listening…"}
        </span>
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
      className="max-h-[147px] min-h-9 overflow-y-auto py-1 text-[14px] font-[430] leading-[21px] text-zinc-800 [scrollbar-width:thin]"
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
