"use client";

/** Plain text during lightweight streams — no fade animation. */
export function StreamingTextFade({
  content,
  className = "markdown-content whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-zinc-800",
}: {
  content: string;
  streamKey?: string;
  className?: string;
}) {
  return <div className={className}>{content}</div>;
}
