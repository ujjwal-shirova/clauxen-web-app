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
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type { AgentToolStep, WebSearchResult } from "@/lib/agent-trace";
import { domainFromUrl } from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import { AgentFileBlock } from "./agent-file-block";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace-primitives";

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;
const HoverCardPortal = HoverCardPrimitive.Portal;
const HoverCardContent = HoverCardPrimitive.Content;

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
        "agent-terminal-pane overflow-x-auto overflow-y-hidden whitespace-pre-wrap break-words rounded-md border px-2.5 py-2 font-mono text-[11.5px] leading-5 [overscroll-behavior-x:contain] [overscroll-behavior-y:auto]",
        tone === "error"
          ? "border-rose-200/80 bg-rose-50/60 text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
          : "border-zinc-200/80 bg-zinc-50/90 text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-900/50 dark:text-zinc-300",
      )}
      data-chat-scroll-passthrough=""
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
    <div
      className={cn(
        "border-t border-zinc-200/70 first:border-t-0 dark:border-zinc-700/70",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[10.5px] font-medium uppercase tracking-[0.06em]",
          error
            ? "text-rose-500 dark:text-rose-400"
            : "text-zinc-400 dark:text-zinc-500",
          "hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors",
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
            "min-w-0 overflow-x-auto overflow-y-hidden px-3 pb-2.5 [overscroll-behavior-x:contain] [overscroll-behavior-y:auto]",
            mono && "font-mono text-[11.5px] leading-5",
          )}
          data-chat-scroll-passthrough=""
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ToolBody({ children }: { children: ReactNode }) {
  return (
    <div
      className="agent-analyzing-terminal w-full overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] dark:border-zinc-700/80 dark:bg-zinc-950 dark:shadow-none"
      data-chat-scroll-passthrough=""
    >
      {children}
    </div>
  );
}

/** Shared activity-row title: dark verb (shimmers live) + light-gray detail. */
function AgentStepTitle({
  verb,
  detail,
  streaming = false,
  failed = false,
  streamKey,
}: {
  verb: string;
  detail?: string;
  streaming?: boolean;
  failed?: boolean;
  streamKey?: string;
}) {
  const verbNode = failed ? (
    <span className="text-rose-500 dark:text-rose-400">{verb}</span>
  ) : streaming ? (
    <AgentShimmerText key={streamKey} active>
      <span className="agent-activity-label--primary">{verb}</span>
    </AgentShimmerText>
  ) : (
    <span className="agent-activity-label--primary">{verb}</span>
  );

  return (
    <>
      {verbNode}
      {detail ? (
        <span className="agent-activity-label--subtle"> {detail}</span>
      ) : null}
      {streaming ? (
        <span className="agent-activity-label--subtle">…</span>
      ) : null}
    </>
  );
}

/* ─────────────────────────── bash_tool ─────────────────────────── */

function extractExitCode(tool: AgentToolStep): {
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

export function AgentBashToolBlock({ tool }: { tool: AgentToolStep }) {
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

  const headerText = description.trim() || "Using the Linux workspace";

  return (
    <div className="w-full min-w-0" data-agent-step="analyzing">
      <AgentTraceBlock
        leading={<Terminal className="h-4 w-4 text-zinc-500" />}
        title={
          <AgentStepTitle
            verb={
              isRunning
                ? "Running command"
                : failed
                  ? "Command failed"
                  : "Ran command"
            }
            detail={headerText}
            streaming={isRunning}
            failed={failed}
            streamKey={`bash-live-${tool.toolCallId}`}
          />
        }
        trailing={
          !isRunning && code !== null ? (
            <span
              className={cn(
                "shrink-0 text-[11px] font-medium tabular-nums",
                failed
                  ? "text-rose-500 dark:text-rose-400"
                  : "agent-activity-label--subtle",
              )}
            >
              exit {code}
            </span>
          ) : undefined
        }
        isActive={isRunning}
        defaultExpanded={false}
        chevronMode="hover"
        className="agent-bash-block"
        headerClassName="agent-bash-block__header"
        contentClassName="agent-bash-block__body"
        titleClassName="text-inherit"
      >
        <ToolBody>
          <pre
            className={cn(
              "agent-terminal-pane overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[13px] leading-[1.55] text-zinc-700 dark:text-zinc-300",
              failed && "text-rose-600 dark:text-rose-300",
            )}
            data-chat-scroll-passthrough=""
          >
            <code className="text-amber-700 dark:text-amber-300">
              {command}
            </code>
            {stdout.trim() ? `\n${stdout.trimEnd()}` : ""}
            {stderr.trim() ? `\n${stderr.trimEnd()}` : ""}
            {isRunning && !hasOutput ? "\nWaiting for output…" : ""}
          </pre>
        </ToolBody>
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── execute_code ──────────────────────── */

export function AgentExecuteCodeBlock({ tool }: { tool: AgentToolStep }) {
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

  const headerText = description.trim() || "Working with Python";

  return (
    <div className="w-full min-w-0" data-agent-step="analyzing">
      <AgentTraceBlock
        title={
          <AgentStepTitle
            verb={
              isRunning ? "Analyzing" : isError ? "Analysis failed" : "Analyzed"
            }
            detail={headerText}
            streaming={isRunning}
            failed={isError}
            streamKey={`exec-live-${tool.toolCallId}`}
          />
        }
        isActive={isRunning}
        defaultExpanded={false}
        chevronMode="hover"
        className="agent-execute-code-block"
        headerClassName="agent-execute-code-block__header"
        contentClassName="agent-execute-code-block__body"
      >
        <ToolBody>
          {code ? (
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center gap-1.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400 dark:text-zinc-500">
                <FileCode2 className="h-3 w-3" />
                Code
              </div>
              <CodePane>{code}</CodePane>
            </div>
          ) : null}
          {hasOutput || isRunning ? (
            <div className="px-3 pb-2.5">
              <div className="flex items-center gap-1.5 pt-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-400 dark:text-zinc-500">
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
                <p className="text-[11.5px] italic text-zinc-400 dark:text-zinc-500">
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

function WebSearchSourcesMeta({
  favicons,
  count,
}: {
  favicons: string[];
  count: number;
}) {
  const shown = favicons.slice(0, 4);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      data-agent-web-search-meta="true"
    >
      {shown.length > 0 ? (
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
      ) : null}
      {count > 0 ? (
        <span className="agent-activity-label--subtle shrink-0 text-[12px] font-[430] tabular-nums leading-none">
          {count} {count === 1 ? "source" : "sources"}
        </span>
      ) : null}
    </span>
  );
}

/** Hover the full “Searched the web …” row → scrollable sources popup. */
function WebSearchSourcesHover({
  results,
  favicons,
  children,
}: {
  results: WebSearchResult[];
  favicons: string[];
  children: ReactNode;
}) {
  const count = results.length;
  if (count === 0) return <>{children}</>;

  return (
    <HoverCard openDelay={100} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="no-hover no-hover-overlay agent-web-search__trigger inline-flex max-w-full min-w-0 cursor-default items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none outline-none focus-visible:outline-none"
          aria-label={`Searched the web, ${count} sources`}
          onClick={(event) => event.preventDefault()}
        >
          {children}
          <WebSearchSourcesMeta favicons={favicons} count={count} />
        </button>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="agent-web-search-popover z-[3000] w-[min(320px,calc(100vw-2rem))] overflow-hidden p-0"
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <ul
            className="max-h-[min(280px,42vh)] overflow-y-auto overscroll-contain py-0.5 [scrollbar-width:thin]"
            data-agent-web-search="popover-results"
            data-scroll-region=""
          >
            {results.map((row, index) => {
              const domain = resultDomain(row);
              const href = isValidHttpUrl(row.url) ? row.url : undefined;
              return (
                <li key={row.url || index}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex min-w-0 items-start gap-2 px-2.5 py-1.5 transition-colors",
                      href
                        ? "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        : "pointer-events-none",
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      <SearchResultFavicon
                        favicon={row.favicon}
                        title={row.title}
                        size={14}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[12px] font-medium leading-[16px] text-zinc-800 dark:text-zinc-100">
                        {row.title || row.url}
                      </span>
                      {row.snippet ? (
                        <span className="line-clamp-2 text-[11px] leading-[14px] text-zinc-500 dark:text-zinc-400">
                          {row.snippet}
                        </span>
                      ) : null}
                      <span className="truncate text-[10px] leading-[12px] text-zinc-400 dark:text-zinc-500">
                        {domain}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}

export function AgentWebSearchBlock({ tool }: { tool: AgentToolStep }) {
  const isRunning = tool.status === "running";
  const query =
    tool.searchQuery ||
    (typeof tool.args?.query === "string" ? tool.args.query : "") ||
    "";
  const results = useMemo(() => tool.searchResults ?? [], [tool.searchResults]);
  const favicons = useMemo(
    () => extractFavicons(results),
    [tool.searchResults],
  );
  const resultCount = results.length;

  const title = (
    <AgentStepTitle
      verb={isRunning ? "Searching the web" : "Searched the web"}
      detail={query || undefined}
      streaming={isRunning}
      streamKey={`ws-live-${tool.toolCallId}`}
    />
  );

  if (isRunning && resultCount === 0) {
    return (
      <div
        className="agent-web-search flex min-w-0 items-center gap-1.5 text-[13px] font-[430] leading-5 tracking-[-0.01em]"
        data-agent-web-search="running"
        data-agent-step="web_search"
      >
        {title}
      </div>
    );
  }

  const titleSpan = (
    <span className="agent-trace__title min-w-0 max-w-[min(100%,36rem)] truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]">
      {title}
    </span>
  );

  return (
    <div
      className="agent-web-search inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5 overflow-anchor-none"
      data-agent-web-search="row"
      data-agent-step="web_search"
    >
      {resultCount > 0 ? (
        <WebSearchSourcesHover results={results} favicons={favicons}>
          {titleSpan}
        </WebSearchSourcesHover>
      ) : (
        titleSpan
      )}
    </div>
  );
}

/* ─────────────────────────── file_read ─────────────────────────── */

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function AgentFileReadBlock({ tool }: { tool: AgentToolStep }) {
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
              <span className="agent-activity-label--muted">Reading</span>
              <span className="agent-activity-label--subtle"> {name}…</span>
            </AgentShimmerText>
          ) : tool.status === "error" ? (
            <span className="text-rose-500">Failed to read {name}</span>
          ) : (
            <>
              <span className="agent-activity-label--muted">Read</span>
              <span className="agent-activity-label--subtle"> {name}</span>
            </>
          )
        }
        trailing={undefined}
        isActive={isRunning}
        defaultExpanded={false}
        chevronMode="hover"
        className="agent-file-read"
        headerClassName="agent-file-read__header"
        contentClassName="agent-file-read__body"
        titleClassName="text-inherit"
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
              <pre
                className="agent-terminal-pane overflow-x-auto overflow-y-hidden whitespace-pre-wrap break-words rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 font-mono text-[11.5px] leading-5 text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-900/50 dark:text-zinc-300 [overscroll-behavior-x:contain] [overscroll-behavior-y:auto]"
                data-chat-scroll-passthrough=""
              >
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

export function AgentReadSkillBlock({ tool }: { tool: AgentToolStep }) {
  const isRunning = tool.status === "running";
  const skillId =
    typeof tool.args?.skill_id === "string"
      ? tool.args.skill_id
      : typeof tool.args?.id === "string"
        ? tool.args.id
        : typeof tool.args?.name === "string"
          ? tool.args.name
          : "";
  const parsed = tool.result ? tryParseJson(tool.result) : null;
  const name =
    (parsed && typeof parsed.id === "string" && parsed.id) ||
    (parsed && typeof parsed.name === "string" && parsed.name) ||
    skillId;
  const doc =
    (parsed && typeof parsed.content === "string" && parsed.content) ||
    (parsed && typeof parsed.skill === "string" && parsed.skill) ||
    (typeof tool.result === "string" ? tool.result : "");

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title={
          isRunning ? (
            <AgentShimmerText key={`rs-live-${tool.toolCallId}`} active>
              <span className="agent-activity-label--primary">
                Loading skill
              </span>
              {name ? (
                <span className="agent-activity-label--subtle"> {name}</span>
              ) : null}
              <span className="agent-activity-label--subtle">…</span>
            </AgentShimmerText>
          ) : tool.status === "error" ? (
            <span className="text-rose-500">
              Failed to load skill{name ? ` · ${name}` : ""}
            </span>
          ) : (
            <>
              <span className="agent-activity-label--primary">
                Loaded skill
              </span>
              {name ? (
                <span className="agent-activity-label--subtle"> {name}</span>
              ) : null}
            </>
          )
        }
        trailing={<BookOpen className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
        isActive={isRunning}
        defaultExpanded={false}
        chevronMode="hover"
        className="agent-read-skill"
        headerClassName="agent-read-skill__header"
        contentClassName="agent-read-skill__body"
      >
        {doc ? (
          <ToolBody>
            <div className="px-3 py-2.5">
              <pre className="overflow-x-auto overflow-y-hidden whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-zinc-600 dark:text-zinc-400 [overscroll-behavior-x:contain] [overscroll-behavior-y:auto]">
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

export function AgentMcpToolBlock({ tool }: { tool: AgentToolStep }) {
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

export function AgentWeatherBlock({ tool }: { tool: AgentToolStep }) {
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

export function AgentPlacesSearchBlock({ tool }: { tool: AgentToolStep }) {
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

export function AgentImageSearchBlock({ tool }: { tool: AgentToolStep }) {
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

export function AgentAskUserInputBlock({ tool }: { tool: AgentToolStep }) {
  const data = tool.result ? tryParseJson(tool.result) : null;
  const fromResult = Array.isArray(data?.questions)
    ? (data.questions as Array<Record<string, unknown>>)
    : [];
  const fromArgs = Array.isArray(tool.args?.questions)
    ? (tool.args.questions as Array<Record<string, unknown>>)
    : [];
  const questions = fromResult.length > 0 ? fromResult : fromArgs;
  const hasAnswers = questions.some(
    (question) => typeof question.answer === "string" && question.answer.trim(),
  );

  // Pending turns: compact timeline status only. The interactive questionnaire
  // replaces the composer (AskUserInputCard) — never nest that UI here.
  if (!hasAnswers) {
    return (
      <div className="w-full min-w-0">
        <AgentTraceBlock
          title="Asked for your input"
          chevronMode="never"
          className="agent-ask-user"
          headerClassName="agent-ask-user__header"
        />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <AgentTraceBlock
        title="Asked for your input"
        defaultExpanded={false}
        chevronMode="hover"
        className="agent-ask-user"
        headerClassName="agent-ask-user__header"
        contentClassName="agent-ask-user__body"
      >
        <ul className="flex w-full flex-col overflow-hidden rounded-[10px] border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
          {questions.map((question, index) => {
            const choices = Array.isArray(question.choices)
              ? (question.choices as string[])
              : Array.isArray(question.options)
                ? (question.options as string[])
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
      </AgentTraceBlock>
    </div>
  );
}

/* ─────────────────────────── generic fallback ──────────────────── */

export function AgentGenericToolBlock({ tool }: { tool: AgentToolStep }) {
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
  tool: AgentToolStep;
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
    case "weather_fetch":
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
