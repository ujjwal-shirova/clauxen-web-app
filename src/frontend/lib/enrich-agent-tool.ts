import type {
  AgentToolSegment,
  WebSearchResult,
} from "@/frontend/lib/agent-segments";
import { parseToolResult } from "@/frontend/lib/agent-segments";
import { inferLanguageFromPath } from "@/frontend/lib/create-file-tags";

export function enrichToolFromResult(
  tool: AgentToolSegment,
  result: string,
): AgentToolSegment {
  const parsed = parseToolResult(result);
  const next: AgentToolSegment = {
    ...tool,
    result,
    status: "done",
    completedAtMs: tool.completedAtMs ?? Date.now(),
  };

  if (tool.name === "web_search" || tool.name === "web_fetch") {
    if (Array.isArray(parsed)) {
      next.searchResults = parsed as WebSearchResult[];
      const query =
        typeof tool.args?.query === "string"
          ? tool.args.query
          : typeof tool.args?.url === "string"
            ? tool.args.url
            : undefined;
      if (query) next.searchQuery = query;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as {
        error?: string;
        query?: string;
        url?: string;
        results?: unknown;
        title?: string;
        content?: string;
      };
      if (record.error) next.status = "error";
      if (record.query) next.searchQuery = record.query;
      else if (record.url) next.searchQuery = record.url;
      if (Array.isArray(record.results)) {
        next.searchResults = record.results as WebSearchResult[];
      } else if (
        tool.name === "web_fetch" &&
        typeof record.url === "string" &&
        (typeof record.title === "string" || typeof record.content === "string")
      ) {
        next.searchResults = [
          {
            url: record.url,
            title: record.title || record.url,
            snippet:
              typeof record.content === "string"
                ? record.content.slice(0, 240)
                : "",
          },
        ];
        next.searchQuery = record.url;
      }
    }
  }

  if (tool.name === "create_file" || tool.name === "file_write") {
    const pathFromArgs =
      typeof tool.args?.path === "string" ? tool.args.path : undefined;
    const contentFromArgs =
      typeof tool.args?.content === "string"
        ? tool.args.content
        : typeof tool.args?.file_text === "string"
          ? tool.args.file_text
          : undefined;
    if (parsed && typeof parsed === "object") {
      const record = parsed as {
        path?: string;
        content?: string;
        error?: string;
      };
      if (record.error) next.status = "error";
      next.filePath = record.path ?? pathFromArgs ?? next.filePath;
      next.fileContent =
        typeof record.content === "string"
          ? record.content
          : contentFromArgs ?? next.fileContent;
    } else {
      next.filePath = pathFromArgs ?? next.filePath;
      next.fileContent = contentFromArgs ?? next.fileContent;
    }
    if (next.filePath && !next.fileLanguage) {
      next.fileLanguage = inferLanguageFromPath(next.filePath);
    }
  }

  if (tool.name === "present_files" && parsed && typeof parsed === "object") {
    const record = parsed as {
      files?: Array<{ path?: string; content?: string }>;
    };
    const first = record.files?.[0];
    if (first?.path) {
      next.filePath = first.path;
      if (typeof first.content === "string") next.fileContent = first.content;
      next.fileLanguage = inferLanguageFromPath(first.path);
    }
  }

  if (tool.name === "bash_tool" && !next.stdout?.trim()) {
    if (typeof parsed === "string") {
      next.stdout = parsed;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as { stdout?: string; stderr?: string };
      next.stdout = record.stdout ?? next.stdout;
      next.stderr = record.stderr ?? next.stderr;
    }
  }

  return next;
}

/** Rebuild tool UI fields (searchResults, fileContent) from stored result JSON. */
export function enrichPersistedToolSegment(
  tool: AgentToolSegment,
): AgentToolSegment {
  let next = { ...tool };
  if (
    (next.name === "create_file" || next.name === "file_write") &&
    !next.fileContent
  ) {
    const fromArgs =
      typeof next.args?.content === "string"
        ? next.args.content
        : typeof next.args?.file_text === "string"
          ? next.args.file_text
          : undefined;
    if (fromArgs) next.fileContent = fromArgs;
    if (!next.filePath && typeof next.args?.path === "string") {
      next.filePath = next.args.path;
    }
  }
  if (next.result) {
    next = enrichToolFromResult(
      {
        ...next,
        status: next.status === "running" ? "done" : next.status,
      },
      next.result,
    );
  } else if (
    (next.name === "create_file" || next.name === "file_write") &&
    next.filePath &&
    !next.fileLanguage
  ) {
    next.fileLanguage = inferLanguageFromPath(next.filePath);
  }
  return next;
}
