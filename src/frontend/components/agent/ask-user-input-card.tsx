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

/** Compact composer questionnaire — Anthropic AskUserQuestion-inspired. */
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
      dispatchChatSendMessage(formatAskUserInputReply(pairs), {
        bypassQueue: true,
      });
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
      className="ask-user-input-card w-full max-w-[560px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_4px_18px_rgba(24,24,27,0.06)]"
      data-ask-user-input
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5 sm:px-4">
        <h3 className="min-w-0 flex-1 font-serif text-[15px] font-semibold leading-snug tracking-[-0.01em] text-zinc-900">
          {current.question}
        </h3>

        <div className="flex shrink-0 items-center gap-0.5 pt-0.5 text-[11px] text-zinc-400">
          <button
            type="button"
            disabled={currentIndex === 0 || disabled}
            onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
            aria-label="Previous question"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2.8rem] text-center tabular-nums">
            {currentIndex + 1}/{total}
          </span>
          <button
            type="button"
            disabled={currentIndex >= total - 1 || disabled}
            onClick={() =>
              setCurrentIndex((idx) => Math.min(total - 1, idx + 1))
            }
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
            aria-label="Next question"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={disabled}
            className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
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
                "group flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors sm:px-4",
                isHovered ? "bg-zinc-50 text-zinc-900" : "hover:bg-zinc-50/80",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums",
                  isHovered
                    ? "bg-zinc-200 text-zinc-700"
                    : "bg-zinc-100 text-zinc-500",
                )}
              >
                {optionIdx + 1}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                {option}
              </span>
              <ArrowRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-all",
                  isHovered
                    ? "translate-x-0.5 text-zinc-500 opacity-100"
                    : "opacity-0 group-hover:opacity-60",
                )}
                aria-hidden
              />
            </button>
          );
        })}

        {!isMulti ? (
          <div className="flex items-center gap-2 px-3.5 py-2 sm:px-4">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-500">
              <Edit2 className="h-3 w-3" />
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
              className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-[13.5px] text-zinc-800 outline-none placeholder:text-zinc-400"
              aria-label="Custom answer"
            />
            {customText.trim() && !disabled ? (
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Submit custom answer"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-zinc-100 px-3.5 py-2 sm:px-4">
        <button
          type="button"
          onClick={handleSkip}
          disabled={disabled}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
