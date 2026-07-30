"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  MapPin,
  Terminal,
  FileCode2,
  BookOpen,
  FileText,
  Plug,
} from "lucide-react";
import type { AgentToolSegment, WebSearchResult } from "@/lib/agent-segments";
import { domainFromUrl } from "@/lib/agent-segments";
import { cn } from "@/lib/utils";
import { AgentFileBlock } from "./agent-file-block";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

function CodePane({
  children,
  tone = "default",
}: {
  children: string;
  tone?: "default" | "error";
}) {
  return (
    <pre
      className={cn(
        "max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border px-2.5 py-2 font-mono text-[11.5px] leading-5",
        tone === "error"
          ? "border-rose-200/80 bg-rose-50/60 text-rose-600"
          : "border-zinc-200/80 bg-zinc-50/80 text-zinc-700",
      )}
    >
      {children}
    </pre>
  );
}

function formatCountdown(expiryIso: string | undefined): string {
  if (!expiryIso) return "";
  const ms = new Date(expiryIso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

function addMinutesToTime(timeIso: string, minutes: number): string {
  const d = new Date(timeIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A labelled sub-panel inside a tool body — the input/output division. */
function ToolArea({
  label,
  error,
  children,
  defaultOpen = false,
  mono = false,
}: {
  label: string;
  error?: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("border-t border-zinc-200/70 first:border-t-0")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[10.5px] font-medium uppercase tracking-[0.06em]",
          error ? "text-rose-500" : "text-zinc-400",
          "hover:text-zinc-600 transition-colors",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        {label}
      </button>
      {open ? (
        <div
          className={cn(
            "max-h-72 overflow-y-auto px-3 pb-2.5",
            mono && "font-mono text-[11.5px] leading-5",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ToolBody({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      {children}
    </div>
  );
}

/* ─────────────────────────── bash_tool ─────────────────────────── */

function extractExitCode(tool: AgentToolSegment): {
  code: number | null;
  stderr: string;
} {
  const parsed = tool.result ? tryParseJson(tool.result) : null;
  const code =
    parsed && typeof parsed.exitCode === "number"
      ? parsed.exitCode
      : parsed && typeof parsed.exit_code === "number"
        ? parsed.exit_code
        : null;
  const stderr =
    tool.stderr ??
    (parsed && typeof parsed.stderr === "string" ? parsed.stderr : "");
  return { code, stderr };
}

export function AgentBashToolBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const command =
    typeof tool.args?.command === "string" ? tool.args.command : "";
  const description =
    typeof tool.args?.description === "string" ? tool.args.description : "";
  const { code, stderr } = extractExitCode(tool);
  const stdout = tool.stdout ?? "";
  const hasOutput = Boolean(stdout.trim() || stderr.trim());
  const failed = isError || (code !== null && code !== 0);

  const headerText = description.trim()
    ? description.trim()
    : isRunning
      ? "Running command…"
      : "Ran command";

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`bash-live-${tool.toolCallId}`} active>
              {headerText}
            </AgentShimmerText>
          ) : failed ? (
            <span className="text-rose-500">{headerText}</span>
          ) : (
            headerText
          )
        }
        trailing={
          !isRunning && code !== null ? (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                failed
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500",
              )}
            >
              exit {code}
            </span>
          ) : undefined
        }
        isActive={isRunning}
        defaultExpanded
        showChevron
        className="agent-bash-block"
        headerClassName="agent-bash-block__header"
        contentClassName="agent-bash-block__body"
      >
        <ToolBody>
          <div className="px-3 pt-2.5 pb-1">
            <div className="flex items-center gap-1.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400">
              <Terminal className="h-3 w-3" />
              Command
            </div>
            <CodePane>{command}</CodePane>
          </div>
          {hasOutput || isRunning ? (
            <div className="px-3 pb-2.5">
              <div className="flex items-center gap-1.5 pt-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400">
                <ChevronRight className="h-3 w-3" />
                Output
              </div>
              {stdout.trim() ? <CodePane>{stdout}</CodePane> : null}
              {stderr.trim() ? (
                <div className="mt-1.5">
                  <CodePane tone="error">{stderr}</CodePane>
                </div>
              ) : null}
              {isRunning && !stdout.trim() && !stderr.trim() ? (
                <p className="text-[11.5px] italic text-zinc-400">
                  Waiting for output…
                </p>
              ) : null}
            </div>
          ) : null}
        </ToolBody>
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── execute_code ──────────────────────── */

export function AgentExecuteCodeBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const code = typeof tool.args?.code === "string" ? tool.args.code : "";
  const description =
    typeof tool.args?.description === "string" ? tool.args.description : "";
  const stdout = tool.stdout ?? "";
  const stderr = tool.stderr ?? "";
  const parsed = tool.result ? tryParseJson(tool.result) : null;
  const resultStdout =
    stdout ||
    (parsed && typeof parsed.stdout === "string" ? parsed.stdout : "");
  const resultStderr =
    stderr ||
    (parsed && typeof parsed.stderr === "string" ? parsed.stderr : "");
  const hasOutput = Boolean(resultStdout.trim() || resultStderr.trim());

  const headerText = description.trim()
    ? description.trim()
    : isRunning
      ? "Running code…"
      : "Ran code";

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`exec-live-${tool.toolCallId}`} active>
              {headerText}
            </AgentShimmerText>
          ) : isError ? (
            <span className="text-rose-500">{headerText}</span>
          ) : (
            headerText
          )
        }
        isActive={isRunning}
        defaultExpanded
        showChevron
        className="agent-execute-code-block"
        headerClassName="agent-execute-code-block__header"
        contentClassName="agent-execute-code-block__body"
      >
        <ToolBody>
          {code ? (
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center gap-1.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400">
                <FileCode2 className="h-3 w-3" />
                Code
              </div>
              <CodePane>{code}</CodePane>
            </div>
          ) : null}
          {hasOutput || isRunning ? (
            <div className="px-3 pb-2.5">
              <div className="flex items-center gap-1.5 pt-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400">
                <ChevronRight className="h-3 w-3" />
                Output
              </div>
              {resultStdout.trim() ? <CodePane>{resultStdout}</CodePane> : null}
              {resultStderr.trim() ? (
                <div className="mt-1.5">
                  <CodePane tone="error">{resultStderr}</CodePane>
                </div>
              ) : null}
              {isError && !resultStderr.trim() && tool.result ? (
                <div className="mt-1.5">
                  <CodePane tone="error">{tool.result.slice(0, 2000)}</CodePane>
                </div>
              ) : null}
              {isRunning && !hasOutput ? (
                <p className="text-[11.5px] italic text-zinc-400">
                  Waiting for output…
                </p>
              ) : null}
            </div>
          ) : null}
        </ToolBody>
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── web_search ────────────────────────── */

const isValidHttpUrl = (value: string | null | undefined): value is string =>
  Boolean(value && /^https?:\/\//i.test(value));

const extractFavicons = (results: WebSearchResult[]) =>
  Array.from(
    new Set(
      results
        .map((row) => row.favicon)
        .filter(
          (icon): icon is string => typeof icon === "string" && Boolean(icon),
        ),
    ),
  );

function SearchResultFavicon({
  favicon,
  title,
  size = 14,
}: {
  favicon?: string | null;
  title?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [favicon]);

  const shouldShowFallback = !favicon || failed;
  const dimension = `${size}px`;

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70"
      style={{ width: dimension, height: dimension }}
    >
      {shouldShowFallback ? (
        <span
          aria-hidden="true"
          className="bg-zinc-400/70"
          style={{
            WebkitMaskImage: "url(/icons/web.svg)",
            maskImage: "url(/icons/web.svg)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            width: `${Math.max(10, size - 4)}px`,
            height: `${Math.max(10, size - 4)}px`,
            display: "inline-block",
          }}
        />
      ) : (
        <img
          src={favicon!}
          alt={title ?? ""}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function resultDomain(row: WebSearchResult): string {
  return domainFromUrl(row.url);
}

function WebSearchFaviconStack({ favicons }: { favicons: string[] }) {
  const shown = favicons.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <span
      className="flex -space-x-1.5"
      aria-hidden
      data-agent-web-search-favicons="true"
    >
      {shown.map((favicon, index) => (
        <span
          key={`${favicon}-${index}`}
          className="relative inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-white shadow-[0_0_0_1px_rgba(228,228,231,0.9)]"
          style={{ zIndex: shown.length - index }}
        >
          <img
            src={favicon}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = "none";
            }}
          />
        </span>
      ))}
    </span>
  );
}

export function AgentWebSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const query =
    tool.searchQuery ||
    (typeof tool.args?.query === "string" ? tool.args.query : "") ||
    "";
  const results = useMemo(() => tool.searchResults ?? [], [tool.searchResults]);
  const favicons = useMemo(() => extractFavicons(results), [results]);
  const resultCount = results.length;

  // Live search with no rows yet — shimmer only (no expandable chrome).
  if (isRunning && resultCount === 0) {
    return (
      <div
        className="flex min-w-0 items-center gap-1.5 text-[13px] font-[430] leading-5 text-zinc-400"
        data-agent-web-search="running"
      >
        <AgentShimmerText key={`ws-live-${tool.toolCallId}`} active>
          {query ? `Searching "${query}"…` : "Searching the web…"}
        </AgentShimmerText>
      </div>
    );
  }

  const title = isRunning ? (
    <AgentShimmerText key={`ws-live-${tool.toolCallId}`} active>
      {query ? `Searching "${query}"…` : "Searching the web…"}
    </AgentShimmerText>
  ) : query ? (
    <>
      Searched <span className="text-zinc-500">&quot;{query}&quot;</span>
    </>
  ) : (
    "Searched the web"
  );

  // Stay collapsed: only round source icons show on the right near the chevron.
  return (
    <AgentTraceBlock
      title={title}
      trailing={<WebSearchFaviconStack favicons={favicons} />}
      isActive={isRunning}
      defaultExpanded={false}
      showChevron={resultCount > 0}
      className="agent-web-search"
      headerClassName="agent-web-search__header"
      contentClassName="agent-web-search__body"
    >
      {resultCount > 0 ? (
        <ul
          className="flex w-full flex-col overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
          data-agent-web-search="results"
        >
          {results.map((row, index) => {
            const domain = resultDomain(row);
            const published = row.publishedDate?.slice(0, 10);
            return (
              <li
                key={row.url || index}
                className={cn(
                  "agent-web-search__row",
                  index > 0 && "border-t border-zinc-100",
                )}
              >
                <a
                  href={isValidHttpUrl(row.url) ? row.url : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/row flex min-w-0 items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-zinc-50/80"
                >
                  <span className="mt-0.5 shrink-0">
                    <SearchResultFavicon
                      favicon={row.favicon}
                      title={row.title}
                      size={16}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium leading-5 text-zinc-800 group-hover/row:underline underline-offset-2">
                      {row.title || row.url}
                    </span>
                    {row.snippet ? (
                      <span className="line-clamp-2 text-[12px] leading-4.5 text-zinc-500">
                        {row.snippet}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span className="truncate">{domain}</span>
                      {published ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0 tabular-nums">
                            {published}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AgentTraceBlock>
  );
}

/* ─────────────────────────── file_read ─────────────────────────── */

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function AgentFileReadBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const path = typeof tool.args?.path === "string" ? tool.args.path : "";
  const name = path ? baseName(path) : "file";
  const parsed = tool.result ? tryParseJson(tool.result) : null;
  const content =
    parsed && typeof parsed.content === "string"
      ? parsed.content
      : typeof tool.result === "string" && tool.status === "done"
        ? tool.result
        : "";
  const truncated =
    parsed && typeof parsed.truncated === "boolean" ? parsed.truncated : false;

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`fr-live-${tool.toolCallId}`} active>
              Reading {name}…
            </AgentShimmerText>
          ) : tool.status === "error" ? (
            <span className="text-rose-500">Failed to read {name}</span>
          ) : (
            `Read ${name}`
          )
        }
        trailing={
          path ? (
            <span className="max-w-[45%] truncate text-[11px] text-zinc-400">
              {path}
            </span>
          ) : undefined
        }
        isActive={isRunning}
        defaultExpanded={false}
        showChevron
        className="agent-file-read"
        headerClassName="agent-file-read__header"
        contentClassName="agent-file-read__body"
      >
        {content ? (
          <ToolBody>
            <div className="px-3 pt-2.5 pb-2.5">
              <div className="flex items-center gap-1.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400">
                <FileText className="h-3 w-3" />
                Content
                {truncated ? (
                  <span className="normal-case tracking-normal text-amber-500">
                    (truncated)
                  </span>
                ) : null}
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 font-mono text-[11.5px] leading-5 text-zinc-700">
                {content.slice(0, 12000)}
              </pre>
            </div>
          </ToolBody>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            {isRunning ? "Reading file…" : "No content returned."}
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── read_skill ────────────────────────── */

export function AgentReadSkillBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const skillId = typeof tool.args?.id === "string" ? tool.args.id : "";
  const parsed = tool.result ? tryParseJson(tool.result) : null;
  const name =
    parsed && typeof parsed.name === "string" ? parsed.name : skillId;
  const doc =
    parsed && typeof parsed.skill === "string"
      ? parsed.skill
      : (tool.result ?? "");

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`rs-live-${tool.toolCallId}`} active>
              Loading skill{name ? ` · ${name}` : ""}…
            </AgentShimmerText>
          ) : tool.status === "error" ? (
            <span className="text-rose-500">
              Failed to load skill{name ? ` · ${name}` : ""}
            </span>
          ) : (
            `Loaded skill${name ? ` · ${name}` : ""}`
          )
        }
        trailing={<BookOpen className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
        isActive={isRunning}
        defaultExpanded={false}
        showChevron
        className="agent-read-skill"
        headerClassName="agent-read-skill__header"
        contentClassName="agent-read-skill__body"
      >
        {doc ? (
          <ToolBody>
            <div className="px-3 py-2.5">
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-zinc-600">
                {doc.slice(0, 8000)}
              </pre>
            </div>
          </ToolBody>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            {isRunning ? "Reading skill definition…" : "Skill not found."}
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── MCP tools ─────────────────────────── */

function humanizeToolName(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseMcpName(name: string): { server: string; tool: string } {
  const parts = name.split("__");
  if (parts.length >= 3) {
    return { server: parts[1], tool: parts.slice(2).join("__") };
  }
  return { server: "", tool: name };
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AgentMcpToolBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const { server, tool: toolName } = parseMcpName(tool.name);
  const label = server
    ? `${humanizeToolName(server)} · ${humanizeToolName(toolName)}`
    : humanizeToolName(toolName);
  const hasArgs = tool.args && Object.keys(tool.args).length > 0;
  const resultText = tool.result ?? "";

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`mcp-live-${tool.toolCallId}`} active>
              Calling {label}…
            </AgentShimmerText>
          ) : isError ? (
            <span className="text-rose-500">{label} failed</span>
          ) : (
            label
          )
        }
        trailing={<Plug className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
        isActive={isRunning}
        defaultExpanded={isRunning}
        showChevron
        className="agent-mcp-tool"
        headerClassName="agent-mcp-tool__header"
        contentClassName="agent-mcp-tool__body"
      >
        <ToolBody>
          {hasArgs ? (
            <ToolArea label="Input" defaultOpen={isRunning} mono>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 text-zinc-700">
                {prettyJson(tool.args)}
              </pre>
            </ToolArea>
          ) : null}
          {resultText || isRunning ? (
            <ToolArea label="Output" error={isError} defaultOpen={isError} mono>
              {resultText ? (
                <pre
                  className={cn(
                    "overflow-x-auto whitespace-pre-wrap break-words rounded-md border px-2.5 py-2",
                    isError
                      ? "border-rose-200/80 bg-rose-50/60 text-rose-600"
                      : "border-zinc-200/80 bg-zinc-50/80 text-zinc-700",
                  )}
                >
                  {resultText.slice(0, 12000)}
                </pre>
              ) : (
                <p className="text-[11.5px] italic text-zinc-400">
                  Waiting for the server…
                </p>
              )}
            </ToolArea>
          ) : null}
        </ToolBody>
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── weather ───────────────────────────── */

export function AgentWeatherBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const location =
    typeof tool.args?.location === "string" ? tool.args.location : "";
  const data = tool.result ? tryParseJson(tool.result) : null;
  const weather = (data?.weather ?? data) as Record<string, unknown> | null;
  const current = weather?.current as Record<string, unknown> | undefined;
  const forecast = weather?.forecast as
    | Array<Record<string, unknown>>
    | undefined;

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`wx-live-${tool.toolCallId}`} active>
              Checking the weather{location ? ` in ${location}` : ""}…
            </AgentShimmerText>
          ) : (
            `Weather${location ? ` · ${location}` : ""}`
          )
        }
        isActive={isRunning}
        defaultExpanded={isRunning}
        showChevron
        className="agent-weather"
        headerClassName="agent-weather__header"
        contentClassName="agent-weather__body"
      >
        {current ? (
          <ToolBody>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-2xl font-semibold tabular-nums text-zinc-900">
                {String(current.temperature ?? "—")}
                {typeof current.temperature === "number" ? "°" : ""}
              </span>
              <span className="flex flex-col text-[12px] leading-4.5 text-zinc-500">
                <span className="font-medium text-zinc-700">
                  {String(current.condition ?? current.summary ?? "")}
                </span>
                {typeof current.feels_like !== "undefined" ? (
                  <span>Feels like {String(current.feels_like)}°</span>
                ) : null}
              </span>
            </div>
            {forecast && forecast.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto border-t border-zinc-200/70 px-3 py-2">
                {forecast.slice(0, 7).map((day, index) => (
                  <div
                    key={index}
                    className="flex min-w-14 flex-col items-center gap-0.5 text-[11px] text-zinc-500"
                  >
                    <span className="font-medium text-zinc-600">
                      {String(day.day ?? day.label ?? index)}
                    </span>
                    <span className="tabular-nums">
                      {String(day.high ?? day.temp ?? "—")}°
                    </span>
                    <span className="tabular-nums text-zinc-400">
                      {String(day.low ?? "—")}°
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </ToolBody>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            {isRunning
              ? "Fetching forecast…"
              : (tool.result ?? "No weather data.")}
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── places_search ─────────────────────── */

export function AgentPlacesSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const query = typeof tool.args?.query === "string" ? tool.args.query : "";
  const data = tool.result ? tryParseJson(tool.result) : null;
  const places = Array.isArray(data?.places)
    ? (data.places as Array<Record<string, unknown>>)
    : Array.isArray(data?.results)
      ? (data.results as Array<Record<string, unknown>>)
      : [];

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`places-live-${tool.toolCallId}`} active>
              {query ? `Finding ${query}…` : "Searching places…"}
            </AgentShimmerText>
          ) : query ? (
            `Places · ${query}`
          ) : (
            "Places"
          )
        }
        trailing={
          places.length > 0 ? (
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {places.length} place{places.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        isActive={isRunning}
        defaultExpanded={isRunning}
        showChevron
        className="agent-places"
        headerClassName="agent-places__header"
        contentClassName="agent-places__body"
      >
        {places.length > 0 ? (
          <ul className="flex w-full flex-col overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
            {places.map((place, index) => (
              <li
                key={index}
                className={cn(
                  "flex min-w-0 items-start gap-2.5 px-3 py-2.5",
                  index > 0 && "border-t border-zinc-100",
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-zinc-800">
                    {String(place.name ?? "Place")}
                  </span>
                  {place.address ? (
                    <span className="truncate text-[12px] text-zinc-500">
                      {String(place.address)}
                    </span>
                  ) : null}
                </span>
                {place.rating ? (
                  <span className="shrink-0 text-[11.5px] tabular-nums text-zinc-500">
                    ★ {String(place.rating)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            {isRunning ? "Searching…" : "No places found."}
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── image_search ──────────────────────── */

export function AgentImageSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const query = typeof tool.args?.query === "string" ? tool.args.query : "";
  const data = tool.result ? tryParseJson(tool.result) : null;
  const images = Array.isArray(data?.images)
    ? (data.images as Array<Record<string, unknown>>)
    : Array.isArray(data?.results)
      ? (data.results as Array<Record<string, unknown>>)
      : [];

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`img-live-${tool.toolCallId}`} active>
              {query ? `Finding images of ${query}…` : "Searching images…"}
            </AgentShimmerText>
          ) : query ? (
            `Images · ${query}`
          ) : (
            "Images"
          )
        }
        trailing={
          images.length > 0 ? (
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {images.length} image{images.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        isActive={isRunning}
        defaultExpanded={isRunning}
        showChevron
        className="agent-image-search"
        headerClassName="agent-image-search__header"
        contentClassName="agent-image-search__body"
      >
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.slice(0, 8).map((image, index) => {
              const src =
                typeof image.url === "string"
                  ? image.url
                  : typeof image.thumbnail === "string"
                    ? image.thumbnail
                    : null;
              if (!src || !isValidHttpUrl(src)) return null;
              return (
                <a
                  key={index}
                  href={typeof image.source === "string" ? image.source : src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-100"
                >
                  {}
                  <img
                    src={src}
                    alt={typeof image.title === "string" ? image.title : ""}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            {isRunning ? "Searching…" : "No images found."}
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── ask_user_input_v0 ─────────────────── */

export function AgentAskUserInputBlock({ tool }: { tool: AgentToolSegment }) {
  const data = tool.result ? tryParseJson(tool.result) : null;
  const questions = Array.isArray(data?.questions)
    ? (data.questions as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title="Asked for your input"
        defaultExpanded
        showChevron
        className="agent-ask-user"
        headerClassName="agent-ask-user__header"
        contentClassName="agent-ask-user__body"
      >
        {questions.length > 0 ? (
          <ul className="flex w-full flex-col overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
            {questions.map((question, index) => {
              const choices = Array.isArray(question.choices)
                ? (question.choices as string[])
                : [];
              const answer =
                typeof question.answer === "string" ? question.answer : null;
              return (
                <li
                  key={index}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 px-3 py-2.5",
                    index > 0 && "border-t border-zinc-100",
                  )}
                >
                  <span className="text-[13px] font-medium text-zinc-800">
                    {String(question.question ?? `Question ${index + 1}`)}
                  </span>
                  {choices.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {choices.map((choice, choiceIndex) => (
                        <span
                          key={choiceIndex}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11.5px]",
                            answer === choice
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-zinc-50 text-zinc-600",
                          )}
                        >
                          {choice}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {answer && !choices.includes(answer) ? (
                    <span className="text-[12px] text-zinc-600">
                      Answer: {answer}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12.5px] italic text-zinc-400">
            Waiting for your answer…
          </p>
        )}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── generic fallback ──────────────────── */

export function AgentGenericToolBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const isError = tool.status === "error";
  const label =
    tool.description?.trim() || humanizeToolName(tool.name.replace(/_/g, " "));
  const hasArgs = tool.args && Object.keys(tool.args).length > 0;
  const resultText = tool.result ?? "";

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`gen-live-${tool.toolCallId}`} active>
              {label}…
            </AgentShimmerText>
          ) : isError ? (
            <span className="text-rose-500">{label} failed</span>
          ) : (
            label
          )
        }
        isActive={isRunning}
        defaultExpanded={isRunning}
        showChevron
        className="agent-generic-tool"
        headerClassName="agent-generic-tool__header"
        contentClassName="agent-generic-tool__body"
      >
        {hasArgs || resultText ? (
          <ToolBody>
            {hasArgs ? (
              <ToolArea label="Input" mono>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 text-zinc-700">
                  {prettyJson(tool.args)}
                </pre>
              </ToolArea>
            ) : null}
            {resultText ? (
              <ToolArea
                label="Output"
                error={isError}
                defaultOpen={isError}
                mono
              >
                <pre
                  className={cn(
                    "overflow-x-auto whitespace-pre-wrap break-words rounded-md border px-2.5 py-2",
                    isError
                      ? "border-rose-200/80 bg-rose-50/60 text-rose-600"
                      : "border-zinc-200/80 bg-zinc-50/80 text-zinc-700",
                  )}
                >
                  {resultText.slice(0, 12000)}
                </pre>
              </ToolArea>
            ) : null}
          </ToolBody>
        ) : null}
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── dispatcher ────────────────────────── */

export function AgentToolBlock({
  tool,
  previousFileContent,
}: {
  tool: AgentToolSegment;
  previousFileContent?: string;
}) {
  switch (tool.name) {
    case "create_file":
    case "file_write":
    case "present_files":
      return (
        <AgentFileBlock tool={tool} previousContent={previousFileContent} />
      );
    case "bash_tool":
      return <AgentBashToolBlock tool={tool} />;
    case "execute_code":
      return <AgentExecuteCodeBlock tool={tool} />;
    case "web_search":
      return <AgentWebSearchBlock tool={tool} />;
    case "file_read":
      return <AgentFileReadBlock tool={tool} />;
    case "read_skill":
      return <AgentReadSkillBlock tool={tool} />;
    case "weather":
      return <AgentWeatherBlock tool={tool} />;
    case "places_search":
      return <AgentPlacesSearchBlock tool={tool} />;
    case "image_search":
      return <AgentImageSearchBlock tool={tool} />;
    case "ask_user_input_v0":
      return <AgentAskUserInputBlock tool={tool} />;
    default:
      if (tool.name.startsWith("mcp__")) {
        return <AgentMcpToolBlock tool={tool} />;
      }
      return <AgentGenericToolBlock tool={tool} />;
  }
}
