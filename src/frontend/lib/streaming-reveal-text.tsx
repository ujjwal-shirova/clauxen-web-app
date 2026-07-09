"use client";

/**
 * Identity wrapper — streaming text renders as-is (no per-token animation).
 */
export function StreamingRevealText({
  text,
}: {
  text: string;
  streamKey?: string;
  showCursor?: boolean;
}) {
  return <>{text}</>;
}
