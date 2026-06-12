"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  domainFromUrl,
  type AgentToolSegment,
  type WebSearchResult,
} from "@/frontend/lib/agent-segments";
import { AgentTimelineStep } from "./agent-timeline";
import { AgentFaviconStack } from "./agent-favicon-stack";

function SearchResultFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const domain = domainFromUrl(url);

  if (failed) {
    return (
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] font-semibold uppercase text-zinc-500">
        {domain.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      className="mt-0.5 h-5 w-5 shrink-0 rounded bg-zinc-100 object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

function SearchResultRow({ result }: { result: WebSearchResult }) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-50"
    >
      <SearchResultFavicon url={result.url} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-zinc-900">
          {result.title || result.url}
        </div>
        <div className="truncate text-[12px] text-zinc-400">
          {domainFromUrl(result.url)}
        </div>
      </div>
    </a>
  );
}

export function AgentWebSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const [expanded, setExpanded] = useState(tool.status === "running");
  const query =
    tool.searchQuery ??
    (typeof tool.args?.query === "string" ? tool.args.query : "Web search");
  const results = tool.searchResults ?? [];
  const isRunning = tool.status === "running";
  const faviconUrls = results.map((result) => result.url);

  return (
    <AgentTimelineStep
      icon="search"
      isActive={isRunning}
      title={
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="truncate">{query}</span>
          <ChevronDown
            className={cn(
              "icon-md shrink-0 text-zinc-400 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      }
      trailing={
        isRunning ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : results.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <AgentFaviconStack urls={faviconUrls} />
            <span>{results.length} results</span>
          </span>
        ) : undefined
      }
    >
      {expanded ? (
        results.length > 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
            <div className="divide-y divide-zinc-100 px-1 py-1">
              {results.slice(0, 10).map((result) => (
                <SearchResultRow key={result.url} result={result} />
              ))}
            </div>
          </div>
        ) : isRunning ? (
          <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[13px] text-zinc-500">
            Searching the web…
          </div>
        ) : null
      ) : null}
    </AgentTimelineStep>
  );
}

function highlightBash(command: string) {
  const parts = command.split(/(".*?"|'.*?'|\s+)/);
  return parts.map((part, index) => {
    if (/^["']/.test(part)) {
      return (
        <span key={index} className="text-emerald-700">
          {part}
        </span>
      );
    }
    if (/^(echo|date|uname|cd|ls|cat|npm|node|python|pip)\b/.test(part)) {
      return (
        <span key={index} className="text-amber-700">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function AgentBashToolBlock({ tool }: { tool: AgentToolSegment }) {
  const command =
    typeof tool.args?.command === "string" ? tool.args.command : "";
  const description =
    tool.description ??
    (typeof tool.args?.description === "string"
      ? tool.args.description
      : "Running a command");
  const stdout = tool.stdout ?? "";
  const stderr = tool.stderr ?? "";
  const isRunning = tool.status === "running";
  const output = stdout || stderr || (tool.status === "done" ? tool.result : "");

  return (
    <AgentTimelineStep
      icon="bash"
      isActive={isRunning}
      title={description}
    >
      <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-3 py-2">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            bash
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-zinc-800">
            {highlightBash(command)}
          </pre>
        </div>
        {(output || isRunning) && (
          <div className="bg-zinc-50 px-3 py-2.5">
            <div className="mb-1 text-[12px] font-semibold text-zinc-700">
              Output
            </div>
            {isRunning && !output ? (
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Running…
              </div>
            ) : (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-zinc-800">
                {output}
              </pre>
            )}
          </div>
        )}
      </div>
    </AgentTimelineStep>
  );
}

export function AgentGenericToolBlock({ tool }: { tool: AgentToolSegment }) {
  const label =
    tool.description ??
    tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isRunning = tool.status === "running";

  return (
    <AgentTimelineStep
      icon="tool"
      isActive={isRunning}
      title={label}
      trailing={
        isRunning ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : undefined
      }
    >
      {tool.args && Object.keys(tool.args).length > 0 ? (
        <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white px-3 py-2.5">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-zinc-700">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}

export function AgentToolBlock({ tool }: { tool: AgentToolSegment }) {
  if (tool.name === "web_search" || tool.name === "web_fetch") {
    return <AgentWebSearchBlock tool={tool} />;
  }
  if (tool.name === "bash_tool" || tool.name === "run_code_interpreter") {
    return <AgentBashToolBlock tool={tool} />;
  }
  return <AgentGenericToolBlock tool={tool} />;
}
