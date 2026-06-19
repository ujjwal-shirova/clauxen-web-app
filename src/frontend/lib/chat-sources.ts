"use client";

import { domainFromUrl, type WebSearchResult } from "@/frontend/lib/agent-segments";
import { resolveAgentFrames } from "@/frontend/lib/agent-frames";
import type { Message } from "@/frontend/lib/types";

export type ChatSource = WebSearchResult & {
  id: string;
  domain: string;
  messageId: string;
  toolCallId?: string;
  query?: string;
};

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function stripReferenceDefinitions(input: string): string {
  // Remove trailing reference definition lines like:
  // [1]: https://... "Title"
  const lines = input.split(/\r?\n/);
  let end = lines.length;
  while (end > 0) {
    const trimmed = lines[end - 1].trim();
    if (/^\[\d+\]:\s*https?:\/\//.test(trimmed) || trimmed === "") {
      end -= 1;
    } else {
      break;
    }
  }
  return lines.slice(0, end).join("\n").trim();
}

export function collectChatSources(messages: Message[]): ChatSource[] {
  const byUrl = new Map<string, ChatSource>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const frame of resolveAgentFrames(message)) {
      for (const segment of frame.segments) {
        if (segment.kind !== "tool") continue;
        const results = segment.searchResults ?? [];
        for (const result of results) {
          if (!result.url) continue;
          const normalizedUrl = normalizeUrl(result.url);
          if (byUrl.has(normalizedUrl)) continue;
          byUrl.set(normalizedUrl, {
            ...result,
            id: `${message.id}:${normalizedUrl}`,
            url: result.url,
            domain: domainFromUrl(result.url),
            messageId: message.id,
            toolCallId: segment.toolCallId,
            query:
              segment.searchQuery ??
              (typeof segment.args?.query === "string"
                ? segment.args.query
                : undefined),
          });
        }
      }
    }
  }

  return Array.from(byUrl.values());
}

export function collectMessageSources(message: Message): ChatSource[] {
  return collectChatSources([message]);
}
