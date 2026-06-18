"use client";

import {
  isValidElement,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { StreamingTokenReveal } from "@/frontend/lib/streaming-token-reveal";

/** Maps flowtoken animation names to CSS @keyframes identifiers. */
const animations: Record<string, string> = {
  fadeIn: "fadeIn",
  blurIn: "blurIn",
  typewriter: "typewriter",
  slideInFromLeft: "slideInFromLeft",
  fadeAndScale: "fadeAndScale",
  colorTransition: "colorTransition",
  rotateIn: "rotateIn",
  bounceIn: "bounceIn",
  elastic: "elastic",
  highlight: "highlight",
  blurAndSharpen: "blurAndSharpen",
  dropIn: "dropIn",
  slideUp: "slideUp",
  wave: "wave",
};

export {
  computeStreamTokenDurationMs,
  resetStreamTokenSessions,
} from "@/frontend/lib/streaming-token-reveal";

export type StreamAnimationConfig = {
  streamKey?: string;
  animation?: string;
  animationDuration?: string;
  animationTimingFunction?: string;
  sep?: "diff" | "word" | "char";
};

export type StreamFadeConfig = {
  animation: string;
  animationDuration: string;
  animationTimingFunction: string;
};

export function resolveStreamAnimation(animationName = "fadeIn") {
  return (
    animations[animationName as keyof typeof animations] ?? animationName
  );
}

export function useStreamingAnimateText({
  streamKey,
  animation: animationName = "fadeIn",
  animationDuration = "0.45s",
  animationTimingFunction = "ease-out",
}: StreamAnimationConfig = {}) {
  const animation = resolveStreamAnimation(animationName);
  const resolvedStreamKey = streamKey ?? "stream";

  const streamFade: StreamFadeConfig = useMemo(
    () => ({
      animation,
      animationDuration,
      animationTimingFunction,
    }),
    [animation, animationDuration, animationTimingFunction],
  );

  const animateText = useCallback(
    (text: ReactNode) => {
      const items = Array.isArray(text) ? text : [text];

      return items.map((item, index) => {
        if (typeof item === "string") {
          return (
            <StreamingTokenReveal
              key={`stream-text-${index}`}
              sessionKey={`${resolvedStreamKey}::${index}`}
              text={item}
              animationName={animation}
              timingFunction={animationTimingFunction}
            />
          );
        }

        if (isValidElement(item)) {
          const rawType = item.type;
          const typeName =
            typeof rawType === "string"
              ? rawType
              : typeof rawType === "function"
                ? rawType.name
                : undefined;

          if (
            typeName &&
            ["br", "ul", "ol", "td", "th"].includes(typeName)
          ) {
            return item;
          }

          return (
            <span key={`stream-el-${index}`} className="stream-token-enter">
              {item}
            </span>
          );
        }

        return item;
      });
    },
    [animation, animationTimingFunction, resolvedStreamKey],
  );

  return {
    animateText,
    animation,
    streamFade,
  };
}
