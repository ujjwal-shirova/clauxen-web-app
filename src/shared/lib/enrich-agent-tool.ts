import type { AgentToolStep, WebSearchResult } from "@/lib/agent-trace";
import { parseToolResult } from "@/lib/agent-trace";
import { inferLanguageFromPath } from "@/lib/create-file-tags";

export function enrichToolFromResult(
  tool: AgentToolStep,
  result: string,
): AgentToolStep {
  const parsed = parseToolResult(result);
  const next: AgentToolStep = {
    ...tool,
    result,
    status: "done",
    completedAtMs: tool.completedAtMs ?? Date.now(),
  };

  if (
    ["web_search", "web_scrape", "web_map", "web_crawl"].includes(tool.name)
  ) {
    if (Array.isArray(parsed)) {
      next.searchResults = parsed as WebSearchResult[];
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.error === "string") next.status = "error";
      const query = record.query ?? record.url ?? record.domain;
      if (typeof query === "string") next.searchQuery = query;

      if (tool.name === "web_search" && Array.isArray(record.results)) {
        next.searchResults = record.results as WebSearchResult[];
      } else if (tool.name === "web_scrape") {
        const metadata =
          record.metadata &&
          typeof record.metadata === "object" &&
          !Array.isArray(record.metadata)
            ? (record.metadata as Record<string, unknown>)
            : {};
        const url = String(metadata.finalUrl ?? record.url ?? "");
        if (url) {
          const markdown =
            record.markdown &&
            typeof record.markdown === "object" &&
            !Array.isArray(record.markdown)
              ? (record.markdown as Record<string, unknown>).data
              : undefined;
          next.searchResults = [
            {
              url,
              title: String(metadata.title ?? url),
              snippet:
                typeof markdown === "string" ? markdown.slice(0, 240) : "",
            },
          ];
        }
      } else if (tool.name === "web_map" && Array.isArray(record.urls)) {
        next.searchResults = record.urls.flatMap((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
          const item = raw as Record<string, unknown>;
          if (typeof item.url !== "string") return [];
          return [
            {
              url: item.url,
              title: typeof item.title === "string" ? item.title : item.url,
              snippet:
                typeof item.description === "string" ? item.description : "",
            },
          ];
        });
      } else if (tool.name === "web_crawl" && Array.isArray(record.results)) {
        next.searchResults = record.results.flatMap((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
          const page = raw as Record<string, unknown>;
          const metadata =
            page.metadata &&
            typeof page.metadata === "object" &&
            !Array.isArray(page.metadata)
              ? (page.metadata as Record<string, unknown>)
              : {};
          const url = String(metadata.finalUrl ?? metadata.url ?? "");
          if (!url) return [];
          return [
            {
              url,
              title: String(metadata.title ?? url),
              snippet:
                typeof page.markdown === "string"
                  ? page.markdown.slice(0, 240)
                  : "",
            },
          ];
        });
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
          : (contentFromArgs ?? next.fileContent);
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
export function enrichPersistedToolSegment(tool: AgentToolStep): AgentToolStep {
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
