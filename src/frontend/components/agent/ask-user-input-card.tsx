"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  dispatchChatSendMessage,
  formatAskUserInputReply,
} from "@/frontend/lib/chat-send-event";

export type AskUserQuestion = {
  question: string;
  options: string[];
  type?: "single_select" | "multi_select" | "rank_priorities";
};

type AskUserInputCardProps = {
  questions: AskUserQuestion[];
  disabled?: boolean;
};

export function AskUserInputCard({
  questions,
  disabled = false,
}: AskUserInputCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customText, setCustomText] = useState("");
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const total = questions.length;
  const current = questions[currentIndex];
  const isMulti = current?.type === "multi_select";

  const finishAndSend = useCallback(
    (finalAnswers: Record<number, string>) => {
      if (submitted || disabled) return;
      setSubmitted(true);

      const pairs = questions
        .map((q, idx) => {
          const answer = finalAnswers[idx];
          if (!answer?.trim()) return null;
          return { question: q.question, answer: answer.trim() };
        })
        .filter(Boolean) as Array<{ question: string; answer: string }>;

      if (pairs.length === 0) return;
      dispatchChatSendMessage(formatAskUserInputReply(pairs));
    },
    [disabled, questions, submitted],
  );

  const advance = useCallback(
    (answer: string) => {
      if (submitted || disabled || !current) return;

      const nextAnswers = { ...answers, [currentIndex]: answer };
      setAnswers(nextAnswers);
      setCustomText("");
      setHoveredOption(null);

      if (currentIndex < total - 1) {
        setCurrentIndex((idx) => idx + 1);
        return;
      }

      finishAndSend(nextAnswers);
    },
    [
      answers,
      current,
      currentIndex,
      disabled,
      finishAndSend,
      submitted,
      total,
    ],
  );

  const handleSkip = useCallback(() => {
    if (submitted || disabled) return;
    setCustomText("");
    setHoveredOption(null);

    if (currentIndex < total - 1) {
      setCurrentIndex((idx) => idx + 1);
      return;
    }

    finishAndSend(answers);
  }, [answers, currentIndex, disabled, finishAndSend, submitted, total]);

  const handleCustomSubmit = useCallback(() => {
    const value = customText.trim();
    if (!value || submitted || disabled) return;
    advance(value);
  }, [advance, customText, disabled, submitted]);

  useEffect(() => {
    if (submitted || dismissed || disabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!current) return;

      const target = event.target as HTMLElement | null;
      const inCustom =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (inCustom) {
        if (event.key === "Enter" && customText.trim()) {
          event.preventDefault();
          handleCustomSubmit();
        }
        return;
      }

      const num = Number(event.key);
      if (num >= 1 && num <= current.options.length) {
        event.preventDefault();
        advance(current.options[num - 1]!);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    advance,
    current,
    customText,
    disabled,
    dismissed,
    handleCustomSubmit,
    submitted,
  ]);

  if (!current || dismissed || submitted || total === 0) {
    return null;
  }

  return (
    <div
      className="ask-user-input-card my-3 w-full max-w-[520px] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_8px_30px_rgba(24,24,27,0.08)]"
      data-ask-user-input
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-3.5">
        <h3 className="min-w-0 flex-1 font-serif text-[16.5px] font-semibold leading-snug text-zinc-900">
          {current.question}
        </h3>

        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <div className="flex items-center gap-0.5 text-[11.5px] text-zinc-400">
            <button
              type="button"
              disabled={currentIndex === 0 || disabled}
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 disabled:opacity-30"
              aria-label="Previous question"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[3.1rem] text-center tabular-nums">
              {currentIndex + 1} of {total}
            </span>
            <button
              type="button"
              disabled={currentIndex >= total - 1 || disabled}
              onClick={() =>
                setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
              }
              className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 disabled:opacity-30"
              aria-label="Next question"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={disabled}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-100">
        {current.options.map((option, optionIdx) => {
          const isHovered = hoveredOption === optionIdx;
          return (
            <button
              key={`${currentIndex}-${option}`}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHoveredOption(optionIdx)}
              onMouseLeave={() => setHoveredOption(null)}
              onClick={() => advance(option)}
              className={cn(
                "group flex w-full items-center gap-3 px-4 py-3 text-left transition-all active:bg-zinc-100 sm:px-5 sm:py-3.5",
                isHovered
                  ? "bg-zinc-100/80 text-zinc-900"
                  : "hover:bg-zinc-50 hover:text-zinc-900",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-colors",
                  isHovered
                    ? "bg-zinc-200 text-zinc-700"
                    : "bg-zinc-100 text-zinc-500",
                )}
              >
                {optionIdx + 1}
              </span>
              <span className="min-w-0 flex-1 text-[14px] leading-snug">
                {option}
              </span>
              <ArrowRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-all",
                  isHovered
                    ? "text-zinc-500 opacity-100 translate-x-0.5"
                    : "text-transparent opacity-0 group-hover:text-zinc-400 group-hover:opacity-70",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {!isMulti ? (
        <div className="border-t border-zinc-100 px-4 py-3 sm:px-5 sm:py-3.5">
          <div
            className={cn(
              "group/custom flex items-center gap-2.5 rounded-xl border border-transparent bg-transparent px-2 py-1 transition-all",
              customText.trim()
                ? "bg-zinc-50/70"
                : "hover:bg-zinc-50/60 hover:border-zinc-200/60",
              "focus-within:bg-zinc-50 focus-within:border-zinc-200/70 focus-within:shadow-sm",
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors group-focus-within/custom:bg-zinc-200/70 group-focus-within/custom:text-zinc-600">
              <Edit2 className="h-3.5 w-3.5" />
            </span>
            <input
              ref={customInputRef}
              type="text"
              value={customText}
              disabled={disabled}
              onChange={(event) => setCustomText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && customText.trim()) {
                  event.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Something else"
              className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[14px] text-zinc-800 outline-none placeholder:text-zinc-400"
              aria-label="Custom answer"
            />
            {customText.trim() && !disabled ? (
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-all hover:bg-zinc-200 hover:text-zinc-800 active:bg-zinc-300"
                aria-label="Submit custom answer"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end border-t border-zinc-100 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={handleSkip}
          disabled={disabled}
          className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-100 active:bg-zinc-200 active:text-zinc-800 disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
