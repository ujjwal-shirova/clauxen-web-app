"use client";

import { domainFromUrl, type WebSearchResult } from "@/lib/agent-segments";
import { resolveAgentFrames } from "@/lib/agent-frames";
import type { Message } from "@/lib/types";

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
    if (/^\[\d+\]:\s*https?:\/\/\S+/i.test(trimmed) || trimmed === "") {
      end -= 1;
    } else {
      break;
    }
  }
  return lines.slice(0, end).join("\n").trim();
}

/** One citation token: ([Title][N]) · [Title][N] · [N] · [text](url) · bare (url). */
const CITATION_TOKEN_SOURCE = [
  String.raw`\(\s*\[[^\]]{0,120}?\]\[\d{1,3}\]\s*\)`,
  String.raw`\[[^\]\[]{0,120}?\]\[\d{1,3}\]`,
  String.raw`\[\d{1,3}\]`,
  String.raw`\[[^\]]{0,120}?\]\(https?:\/\/[^)\s]+\)`,
].join("|");

const CITATION_CLUSTER_LINE = new RegExp(
  String.raw`^\s*(?:[-*•]\s*)?(?:(?:${CITATION_TOKEN_SOURCE})[\s,;·|]*)+$`,
);

const SOURCES_HEADING_LINE =
  /^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:sources?|references?|citations?)(?:\*\*)?\s*:?\s*$/i;

/**
 * Drop a trailing block that is nothing but citations (optionally under a
 * "Sources"/"References" heading). Source chips must only appear where the
 * assistant explicitly wove them into prose — never as an auto footer group.
 */
export function stripTrailingCitationClusters(input: string): string {
  if (!input) return input;
  const lines = input.split(/\r?\n/);
  let end = lines.length;
  let removedCluster = false;

  while (end > 0) {
    const trimmed = (lines[end - 1] ?? "").trim();
    if (trimmed === "") {
      end -= 1;
      continue;
    }
    if (CITATION_CLUSTER_LINE.test(trimmed)) {
      end -= 1;
      removedCluster = true;
      continue;
    }
    if (removedCluster && SOURCES_HEADING_LINE.test(trimmed)) {
      end -= 1;
      continue;
    }
    break;
  }

  if (!removedCluster || end === lines.length) return input;
  return lines.slice(0, end).join("\n").replace(/\s+$/, "");
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

function normalizeCitationKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSourceByTitleOrDomain(
  label: string,
  sources: ChatSource[],
): ChatSource | undefined {
  const key = normalizeCitationKey(label);
  if (!key) return undefined;

  const exact = sources.find((src) => {
    const title = normalizeCitationKey(src.title || "");
    const domain = normalizeCitationKey(src.domain || domainFromUrl(src.url));
    return title === key || domain === key || domain.startsWith(key);
  });
  if (exact) return exact;

  return sources.find((src) => {
    const title = normalizeCitationKey(src.title || "");
    const domain = normalizeCitationKey(src.domain || domainFromUrl(src.url));
    return (
      (title && (title.includes(key) || key.includes(title))) ||
      (domain && (domain.includes(key) || key.includes(domain)))
    );
  });
}

function resolveCitationSource(
  sources: ChatSource[],
  index: number,
  label?: string,
): ChatSource | undefined {
  const byIndex = sources[index - 1];
  if (byIndex) return byIndex;
  if (label) return findSourceByTitleOrDomain(label, sources);
  return undefined;
}

/**
 * Convert citation markers in the LLM output text into direct markdown links.
 * This allows the renderer to turn model citations like ([Title][3]) or [3]
 * into inline SourceChip components (by matching on the target URL).
 *
 * Supported patterns (1-based index into the provided sources array):
 *   - [Title][N]
 *   - ([Title][N])
 *   - bare [N]
 *
 * If N is out of range, falls back to title/domain match. Unmatched markers
 * are stripped to plain title text so raw `([The Hindu][9])` never leaks.
 */
export function convertCitationReferencesToLinks(
  text: string,
  sources: ChatSource[],
): string {
  if (!text) return text;

  let result = text;

  // Handle parenthesized citation form used by the model: ([Title][N])
  result = result.replace(
    /\(\s*\[([^\]]+?)\]\[(\d+)\]\s*\)/g,
    (_match, title: string, nStr: string) => {
      const n = parseInt(nStr, 10);
      const src = resolveCitationSource(sources, n, title);
      if (src) return `[${title}](${src.url})`;
      // Prefer a clean domain/title chip-less fallback over raw markup.
      return title.trim() || "";
    },
  );

  // [TitleOrDomain][N]  -->  [TitleOrDomain](https://url)
  result = result.replace(
    /\[([^\]\[]+?)\]\[(\d+)\]/g,
    (_match, title: string, nStr: string) => {
      const n = parseInt(nStr, 10);
      const src = resolveCitationSource(sources, n, title);
      if (src) return `[${title}](${src.url})`;
      return title.trim() || "";
    },
  );

  // Bare numeric citation [N] --> direct link (chip replaces the link content)
  result = result.replace(
    /(^|[^[\]])\[(\d+)\](?!\(|\[)/g,
    (match, prefix: string, nStr: string) => {
      const n = parseInt(nStr, 10);
      const src = resolveCitationSource(sources, n);
      if (src) {
        return `${prefix}[](${src.url})`;
      }
      // Drop unknown bare indices rather than leaving [9] in the prose.
      return prefix;
    },
  );

  return result;
}
