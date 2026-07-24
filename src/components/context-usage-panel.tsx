"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const CONTEXT_TOKEN_LIMIT = 128_000;
const CHAT_STORAGE_KEY = "clauxen-chat-state-v1";

type ContextSegment = {
  label: string;
  tokens: number;
  color: string;
};

type ContextBreakdown = {
  percent: number;
  totalTokens: number;
  limit: number;
  segments: ContextSegment[];
};

function estimateTokens(text: string) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function loadConversationChars(chatKey?: string) {
  let conversationChars = 0;
  let thinkingChars = 0;

  if (typeof window === "undefined") {
    return { conversationChars, thinkingChars };
  }

  try {
    const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) return { conversationChars, thinkingChars };

    const parsed = JSON.parse(saved) as {
      allChats?: Record<
        string,
        Array<{ content?: string; thinkingContent?: string }>
      >;
      activeChatId?: string | null;
    };
    const chatId = chatKey ?? parsed.activeChatId;
    const messages = chatId ? parsed.allChats?.[chatId] : undefined;

    if (!Array.isArray(messages)) {
      return { conversationChars, thinkingChars };
    }

    for (const message of messages) {
      conversationChars += message.content?.length ?? 0;
      thinkingChars += message.thinkingContent?.length ?? 0;
    }
  } catch {
    // ignore storage read errors
  }

  return { conversationChars, thinkingChars };
}

export function getContextBreakdown(
  prompt: string,
  chatKey?: string,
): ContextBreakdown {
  const { conversationChars, thinkingChars } = loadConversationChars(chatKey);
  const draftTokens = estimateTokens(prompt);
  const conversationTokens =
    Math.ceil(conversationChars / 4) + Math.ceil(thinkingChars / 4);

  const segments: ContextSegment[] = [
    { label: "System prompt", tokens: 494, color: "#a1a1aa" },
    { label: "Tool definitions", tokens: 0, color: "#a78bfa" },
    { label: "Rules", tokens: 0, color: "#4ade80" },
    { label: "Skills", tokens: 0, color: "#fb923c" },
    { label: "MCP", tokens: 0, color: "#c4b5fd" },
    { label: "Subagent definitions", tokens: 0, color: "#38bdf8" },
    { label: "Summarized conversation", tokens: 0, color: "#f472b6" },
    {
      label: "Conversation",
      tokens: conversationTokens + draftTokens,
      color: "#64748b",
    },
  ];

  const totalTokens = segments.reduce((sum, segment) => sum + segment.tokens, 0);
  const percent = Math.min(
    100,
    Math.round((totalTokens / CONTEXT_TOKEN_LIMIT) * 100),
  );

  return {
    percent,
    totalTokens,
    limit: CONTEXT_TOKEN_LIMIT,
    segments,
  };
}

function formatTokenCount(tokens: number) {
  if (tokens >= 1000) {
    const value = tokens / 1000;
    return value >= 10 ? `${Math.round(value)}K` : `${value.toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

function formatTokenTotal(tokens: number) {
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}K`;
  }
  return `~${tokens.toLocaleString()}`;
}

function formatTokenLimit(limit: number) {
  if (limit >= 1000) {
    return `${Math.round(limit / 1000)}K`;
  }
  return limit.toLocaleString();
}

type ContextUsageIndicatorProps = {
  prompt: string;
  chatKey?: string;
};

export function ContextUsageIndicator({
  prompt,
  chatKey,
}: ContextUsageIndicatorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const breakdown = useMemo(
    () =>
      mounted
        ? getContextBreakdown(prompt, chatKey)
        : getContextBreakdown(prompt, undefined),
    [mounted, prompt, chatKey],
  );
  const { percent, totalTokens, limit, segments } = breakdown;

  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const activeSegments = segments.filter((segment) => segment.tokens > 0);
  const segmentTotal = activeSegments.reduce(
    (sum, segment) => sum + segment.tokens,
    0,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          aria-label={`Context window ${percent}% used`}
          className="context-usage-trigger no-hover no-hover-overlay inline-flex w-fit shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-normal text-zinc-500"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden
            className="shrink-0"
          >
            <circle
              cx="9"
              cy="9"
              r={radius}
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="2.5"
            />
            <circle
              cx="9"
              cy="9"
              r={radius}
              fill="none"
              stroke="#52525b"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 9 9)"
            />
          </svg>
          <span>{percent}%</span>
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-[0_8px_24px_-8px_rgba(24,24,27,0.12),0_0_0_1px_rgba(24,24,27,0.04)]"
      >
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-medium leading-5 text-zinc-900">
              Context
            </h3>
            <PopoverPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close context panel"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverPrimitive.Close>
          </div>

          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-[430] text-zinc-500">
              {percent}% Full
            </span>
            <span className="text-[13px] font-[430] text-zinc-500">
              {formatTokenTotal(totalTokens)} / {formatTokenLimit(limit)} Tokens
            </span>
          </div>

          <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-zinc-100">
            {activeSegments.map((segment) => (
              <div
                key={segment.label}
                className="h-full"
                style={{
                  width: `${(segment.tokens / Math.max(segmentTotal, 1)) * 100}%`,
                  backgroundColor: segment.color,
                }}
              />
            ))}
          </div>

          <div className="space-y-2">
            {segments.map((segment) => (
              <div
                key={segment.label}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden
                  />
                  <span className="truncate text-[13px] font-[430] text-zinc-700">
                    {segment.label}
                  </span>
                </div>
                <span className="shrink-0 text-[13px] font-[430] tabular-nums text-zinc-500">
                  {formatTokenCount(segment.tokens)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
