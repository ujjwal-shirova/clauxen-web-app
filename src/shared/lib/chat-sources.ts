"use client";

import {
  domainFromUrl,
  type WebSearchResult,
  type AgentStep,
} from "@/lib/agent-trace";
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

    const steps = message.agentTrace?.steps ?? [];
    for (const segment of steps) {
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

const MD_CITATION_LINK = String.raw`\[(?:[^\]]*)\]\(https?:\/\/[^)\s]+\)`;

/**
 * Strip model decoration around citation link clusters so chips don't render
 * with literal parentheses / commas: `( [chip] , [chip] )` → `[chip] [chip]`.
 */
export function unwrapCitationLinkDecorators(text: string): string {
  if (!text) return text;

  const clusterInParens = new RegExp(
    String.raw`\(\s*((?:${MD_CITATION_LINK}\s*[,;·|]?\s*)+)\s*\)`,
    "g",
  );
  const sepBetweenLinks = new RegExp(
    String.raw`(${MD_CITATION_LINK})\s*[,;·|]\s*(?=${MD_CITATION_LINK})`,
    "g",
  );
  // Lone parenthesized chip left after conversion: ( [Title](url) )
  const singleParenLink = new RegExp(
    String.raw`\(\s*(${MD_CITATION_LINK})\s*\)`,
    "g",
  );

  return text
    .replace(clusterInParens, (_match, inner: string) =>
      String(inner).replace(sepBetweenLinks, "$1 ").replace(/\s+/g, " ").trim(),
    )
    .replace(singleParenLink, "$1")
    .replace(sepBetweenLinks, "$1 ");
}

function citationTokenToLink(
  sources: ChatSource[],
  title: string,
  nStr: string,
): string {
  const n = parseInt(nStr, 10);
  const src = resolveCitationSource(sources, n, title);
  if (src) return `[${title}](${src.url})`;
  return title.trim() || "";
}

/**
 * Convert citation markers in the LLM output text into direct markdown links.
 * This allows the renderer to turn model citations like ([Title][3]) or [3]
 * into inline SourceChip components (by matching on the target URL).
 *
 * Supported patterns (1-based index into the provided sources array):
 *   - [Title][N]
 *   - ([Title][N])
 *   - ([Title][N], [Title][M]) multi-cite paren clusters
 *   - bare [N]
 *
 * If N is out of range, falls back to title/domain match. Unmatched markers
 * are stripped to plain title text so raw `([The Hindu][9])` never leaks.
 * Wrapping parentheses / commas around converted link clusters are removed.
 */
export function convertCitationReferencesToLinks(
  text: string,
  sources: ChatSource[],
): string {
  if (!text) return text;

  let result = text;

  // Multi-cite paren cluster: ([A][1], [B][2]) → links without wrapping parens
  result = result.replace(
    /\(\s*((?:\[[^\]]+?\]\[\d+\]\s*[,;·|]?\s*){2,})\s*\)/g,
    (_match, inner: string) =>
      String(inner)
        .replace(/\[([^\]]+?)\]\[(\d+)\]/g, (_m, title: string, nStr: string) =>
          citationTokenToLink(sources, title, nStr),
        )
        .replace(/\s*[,;·|]\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
  );

  // Handle parenthesized citation form used by the model: ([Title][N])
  result = result.replace(
    /\(\s*\[([^\]]+?)\]\[(\d+)\]\s*\)/g,
    (_match, title: string, nStr: string) =>
      citationTokenToLink(sources, title, nStr),
  );

  // [TitleOrDomain][N]  -->  [TitleOrDomain](https://url)
  result = result.replace(
    /\[([^\]\[]+?)\]\[(\d+)\]/g,
    (_match, title: string, nStr: string) =>
      citationTokenToLink(sources, title, nStr),
  );

  // Bare numeric citation [N] --> direct link (chip replaces the link content)
  result = result.replace(
    /(^|[^[\]])\[(\d+)\](?!\(|\[)/g,
    (_match, prefix: string, nStr: string) => {
      const n = parseInt(nStr, 10);
      const src = resolveCitationSource(sources, n);
      if (src) {
        return `${prefix}[](${src.url})`;
      }
      // Drop unknown bare indices rather than leaving [9] in the prose.
      return prefix;
    },
  );

  return unwrapCitationLinkDecorators(result);
}
