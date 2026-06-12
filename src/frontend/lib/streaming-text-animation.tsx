"use client";

import {
  isValidElement,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
// FlowToken internals — public package only exports AnimatedMarkdown; we reuse its tokenizer.
import SplitText from "flowtoken/dist/components/SplitText";
import { animations } from "flowtoken/dist/utils/animations";

export type StreamAnimationConfig = {
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
  animation: animationName = "fadeIn",
  animationDuration = "0.45s",
  animationTimingFunction = "ease-out",
  sep = "diff",
}: StreamAnimationConfig = {}) {
  const animation = resolveStreamAnimation(animationName);

  const blockAnimationStyle = useMemo(
    () => ({
      animation: `${animation} ${animationDuration} ${animationTimingFunction}`,
      animationIterationCount: 1 as const,
    }),
    [animation, animationDuration, animationTimingFunction],
  );

  const tokenAnimationStyle = useMemo(
    () => ({
      animationName: animation,
      animationDuration,
      animationTimingFunction,
      animationIterationCount: 1 as const,
      whiteSpace: "pre-wrap" as const,
      display: "inline-block" as const,
    }),
    [animation, animationDuration, animationTimingFunction],
  );

  const animateText = useCallback(
    (text: ReactNode) => {
      const items = Array.isArray(text) ? text : [text];

      return items.map((item, index) => {
        if (typeof item === "string") {
          return (
            <SplitText
              key={`stream-text-${index}`}
              input={item}
              sep={sep}
              animation={animation}
              animationDuration={animationDuration}
              animationTimingFunction={animationTimingFunction}
              animationIterationCount={1}
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
            <span key={`stream-el-${index}`} style={tokenAnimationStyle}>
              {item}
            </span>
          );
        }

        return item;
      });
    },
    [
      animation,
      animationDuration,
      animationTimingFunction,
      sep,
      tokenAnimationStyle,
    ],
  );

  const streamFade: StreamFadeConfig = useMemo(
    () => ({
      animation,
      animationDuration,
      animationTimingFunction,
    }),
    [animation, animationDuration, animationTimingFunction],
  );

  return {
    animateText,
    animation,
    blockAnimationStyle,
    streamFade,
  };
}
