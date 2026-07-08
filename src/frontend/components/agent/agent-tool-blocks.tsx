"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import { LoaderCircle, Check, Copy, ExternalLink, ArrowUp, Plus, Calendar, MapPin, Star, Sparkles, CloudSun, Compass, ShieldAlert, Award, Image as ImageIcon } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  domainFromUrl,
  type AgentToolSegment,
  type WebSearchResult,
} from "@/frontend/lib/agent-segments";
import { AgentTimelineStep } from "./agent-timeline";
import { AgentFaviconStack } from "./agent-favicon-stack";
import { AgentFileBlock } from "./agent-file-block";
import {
  AskUserInputCard,
  type AskUserQuestion,
} from "./ask-user-input-card";
import { HighlightCode } from "@/frontend/lib/syntax-highlight";
import { StreamingTextFade } from "@/frontend/lib/streaming-text-fade";
import { animations as flowtokenAnimations } from "@flowtoken/utils/animations";
import type { StreamFadeConfig } from "@/frontend/lib/streaming-text-animation";

const BASH_COMMAND_STREAM_FADE: StreamFadeConfig = {
  animation: flowtokenAnimations.fadeIn,
  animationDuration: "80ms",
  animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function SearchResultFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const domain = domainFromUrl(url);

  if (failed) {
    return (
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-100 text-[9px] font-semibold uppercase text-zinc-500">
        {domain.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      className="h-4 w-4 shrink-0 rounded bg-zinc-100 object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

function SearchResultRow({
  result,
  index,
}: {
  result: WebSearchResult;
  index: number;
}) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-2 py-1.5 transition-colors hover:bg-zinc-50 animate-in fade-in slide-in-from-bottom-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <SearchResultFavicon url={result.url} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium leading-4 text-zinc-900">
          {result.title || result.url}
        </div>
        <div className="truncate text-[11px] leading-3.5 text-zinc-400">
          {domainFromUrl(result.url)}
        </div>
      </div>
    </a>
  );
}

export function AgentWebSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const query =
    tool.searchQuery ??
    (typeof tool.args?.query === "string" ? tool.args.query : "Web search");
  const results = tool.searchResults ?? [];
  const isRunning = tool.status === "running";
  const faviconUrls = results.map((result) => result.url);
  const [visibleCount, setVisibleCount] = useState(0);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (results.length === 0) {
      setVisibleCount(0);
      prevLengthRef.current = 0;
      return;
    }

    if (results.length < prevLengthRef.current) {
      setVisibleCount(results.length);
      prevLengthRef.current = results.length;
      return;
    }

    if (visibleCount >= results.length) {
      prevLengthRef.current = results.length;
      return;
    }

    const delay = visibleCount === 0 ? 0 : 110;
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, results.length));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [results.length, visibleCount, results]);

  useEffect(() => {
    if (!isRunning && results.length > 0) {
      setVisibleCount(results.length);
    }
  }, [isRunning, results.length]);

  const visibleResults = results.slice(0, visibleCount);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showResultsContainer = isRunning || visibleResults.length > 0;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleResults.length, isRunning]);

  return (
    <AgentTimelineStep
      icon="search"
      isActive={isRunning}
      title={
        <span className={cn("truncate", isRunning && "shimmer-text")}>
          {query}
        </span>
      }
      trailing={
        isRunning ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : results.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <AgentFaviconStack urls={faviconUrls.slice(0, 10)} />
            <span>{results.length} results</span>
          </span>
        ) : undefined
      }
    >
      {showResultsContainer ? (
        <div className="rounded-[12px] border border-zinc-200 bg-zinc-50/70 px-2 py-2">
          <div
            ref={scrollRef}
            className="flex max-h-[18rem] min-h-[3.5rem] flex-col gap-1 overflow-y-auto pr-0.5"
          >
            {visibleResults.slice(0, 10).map((result, index) => (
              <SearchResultRow
                key={result.url}
                result={result}
                index={index}
              />
            ))}
            {isRunning && visibleResults.length === 0 ? (
              <div className="flex items-center px-1 py-2 text-[12px] text-zinc-500 shimmer-text">
                Searching the web…
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}

/** Autoscrolls a growing <pre>/code area to its latest line, same pattern as
 * AgentThinkingStep / AgentWebSearchBlock's result list. */
function useAutoScrollToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
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
  // Two sub-phases while status is "running": the model is still typing the
  // command (argsComplete === false, sandbox not touched yet), or the full
  // command is finalized and it has actually been sent to the sandbox. Only
  // the second phase shows the Output panel — matches the reference flow of
  // "write the command, then run it, then show the result".
  const isTyping = isRunning && tool.argsComplete === false;
  const isExecuting = isRunning && !isTyping;
  const output =
    stdout || stderr || (tool.status === "done" ? tool.result ?? "" : "");

  const commandScrollRef = useAutoScrollToBottom(command);
  const outputScrollRef = useAutoScrollToBottom(output);

  return (
    <AgentTimelineStep
      icon="bash"
      isActive={isRunning}
      title={
        <span className={cn(isRunning && "shimmer-text")}>{description}</span>
      }
    >
      <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)]">
        <div className="border-b border-zinc-100 bg-[#f4f4f5] px-3 py-2.5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            bash
          </div>
          <div ref={commandScrollRef} className="max-h-40 overflow-auto">
            <HighlightCode
              code={command}
              language="bash"
              showLineNumbers={false}
              streamFade={isTyping ? BASH_COMMAND_STREAM_FADE : undefined}
            />
          </div>
        </div>
        {isExecuting || tool.status === "done" || tool.status === "error" ? (
          <div className="bg-[#f4f4f5] px-3 py-2.5">
            <div className="mb-1.5 text-[12px] font-semibold text-zinc-700">
              Output
            </div>
            {isExecuting && !output ? (
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Running…
              </div>
            ) : (
              <div
                ref={outputScrollRef}
                className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-zinc-900"
              >
                {isExecuting ? (
                  <StreamingTextFade
                    content={output}
                    streamKey={tool.toolCallId}
                    className=""
                  />
                ) : (
                  output
                )}
              </div>
            )}
          </div>
        ) : null}
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
      title={<span className={cn(isRunning && "shimmer-text")}>{label}</span>}
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

// ─── Interactive Tool Components ───────────────────────────────────────────

export function AskUserInputBlock({ tool }: { tool: AgentToolSegment }) {
  const questions = (tool.args?.questions as AskUserQuestion[]) ?? [];
  const isInteractive =
    tool.status === "done" &&
    questions.length > 0 &&
    !tool.result?.includes('"error"');

  if (!isInteractive) {
    return (
      <AgentTimelineStep
        icon="tool"
        isActive={tool.status === "running"}
        title="Gathering preferences"
      />
    );
  }

  return <AskUserInputCard questions={questions} />;
}

export function SportsDataBlock({ tool }: { tool: AgentToolSegment }) {
  const result = tool.result ? JSON.parse(tool.result) : null;
  const isRunning = tool.status === "running";

  return (
    <AgentTimelineStep icon="tool" isActive={isRunning} title="Sports Scores & Stats">
      {isRunning ? (
        <div className="text-[13px] text-zinc-500">Fetching live sports data...</div>
      ) : result ? (
        <div className="flex flex-col gap-3 max-w-md">
          {result.games?.map((game: any) => (
            <div key={game.id} className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
              <div className="bg-zinc-50 px-3 py-1.5 flex justify-between items-center border-b border-zinc-100">
                <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">{result.league}</span>
                <span className="text-[11px] font-semibold text-zinc-600">{game.status}</span>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-medium text-zinc-800">{game.awayTeam}</span>
                  <span className="text-[18px] font-bold text-zinc-900">{game.awayScore}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-medium text-zinc-800">{game.homeTeam}</span>
                  <span className="text-[18px] font-bold text-zinc-900">{game.homeScore}</span>
                </div>
              </div>
            </div>
          ))}
          {result.standings && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h4 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Standings</h4>
              <div className="flex flex-col gap-2">
                {result.standings.map((team: any) => (
                  <div key={team.team} className="flex justify-between text-[13px] text-zinc-700">
                    <span>{team.rank}. {team.team}</span>
                    <span className="font-semibold">{team.wins}W - {team.losses}L</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}

export function ImageSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const result = tool.result ? JSON.parse(tool.result) : null;
  const isRunning = tool.status === "running";

  return (
    <AgentTimelineStep icon="tool" isActive={isRunning} title={`Image Search: ${tool.args?.query}`}>
      {isRunning ? (
        <div className="text-[13px] text-zinc-500">Searching for images...</div>
      ) : result?.images ? (
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {result.images.map((img: any, i: number) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50">
              <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </AgentTimelineStep>
  );
}

export function MessageComposeBlock({ tool }: { tool: AgentToolSegment }) {
  const variants = (tool.args?.variants as any[]) ?? [];
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = variants[selected];

  const handleCopy = async () => {
    if (!current) return;
    const text = tool.args?.kind === "email" && current.subject
      ? `Subject: ${current.subject}\n\n${current.body}`
      : current.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AgentTimelineStep icon="tool" isActive={tool.status === "running"} title="Message Drafter">
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm max-w-md">
        {tool.args?.summary_title && (
          <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100 text-[13px] font-semibold text-zinc-700">
            {String(tool.args.summary_title)}
          </div>
        )}
        {variants.length > 1 && (
          <div className="flex border-b border-zinc-100 overflow-x-auto">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex-1 px-4 py-2 text-[12px] font-medium border-b-2 transition-all whitespace-nowrap",
                  selected === i
                    ? "border-zinc-900 text-zinc-900 font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        {current && (
          <div className="p-4">
            {tool.args?.kind === "email" && current.subject && (
              <div className="mb-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Subject</span>
                <p className="text-[13px] font-semibold text-zinc-800">{current.subject}</p>
              </div>
            )}
            <div className="rounded-lg bg-zinc-50 p-3 font-mono text-[12px] text-zinc-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {current.body}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCopy}
                className="rounded-lg border border-zinc-200 bg-white text-zinc-700 text-[12px] font-semibold px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AgentTimelineStep>
  );
}

export function MapDisplayBlock({ tool }: { tool: AgentToolSegment }) {
  const locations = (tool.args?.locations as any[]) ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const narrative = tool.args?.narrative ? String(tool.args.narrative) : undefined;

  return (
    <AgentTimelineStep icon="tool" isActive={tool.status === "running"} title={String(tool.args?.title ?? "Interactive Map")}>
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm max-w-md">
        {narrative && (
          <div className="p-4 border-b border-zinc-100 text-[13px] text-zinc-600 leading-relaxed">
            {narrative}
          </div>
        )}
        <div className="bg-zinc-50 h-32 flex items-center justify-center text-[12px] text-zinc-400 border-b border-zinc-100">
          Interactive Map Display ({locations.length} points)
        </div>
        <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
          {locations.map((loc, i) => (
            <div
              key={i}
              onClick={() => setSelected(selected === i ? null : i)}
              className={cn(
                "p-3 cursor-pointer transition-colors flex flex-col gap-1",
                selected === i ? "bg-zinc-50" : "hover:bg-zinc-50/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-[13px] font-semibold text-zinc-800">{loc.name}</span>
              </div>
              {selected === i && loc.notes && (
                <p className="pl-7 text-[12px] text-zinc-500 italic leading-relaxed">{loc.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </AgentTimelineStep>
  );
}

export function RecipeDisplayBlock({ tool }: { tool: AgentToolSegment }) {
  const ingredients = (tool.args?.ingredients as any[]) ?? [];
  const steps = (tool.args?.steps as any[]) ?? [];
  const [servings, setServings] = useState(Number(tool.args?.base_servings ?? 4));
  const baseServings = Number(tool.args?.base_servings ?? 4);
  const multiplier = servings / baseServings;
  const description = tool.args?.description ? String(tool.args.description) : undefined;

  return (
    <AgentTimelineStep icon="tool" isActive={tool.status === "running"} title={String(tool.args?.title ?? "Recipe")}>
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm max-w-md">
        {description && (
          <div className="p-4 border-b border-zinc-100 text-[13px] text-zinc-600">
            {description}
          </div>
        )}
        <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-zinc-700">Servings</span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="h-6 w-6 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 flex items-center justify-center font-bold text-[14px]"
            >
              -
            </button>
            <span className="text-[14px] font-bold text-zinc-800 min-w-[20px] text-center">{servings}</span>
            <button
              onClick={() => setServings(servings + 1)}
              className="h-6 w-6 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 flex items-center justify-center font-bold text-[14px]"
            >
              +
            </button>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div>
            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Ingredients</h4>
            <ul className="flex flex-col gap-1.5">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex justify-between text-[13px] text-zinc-700">
                  <span>{ing.name}</span>
                  <span className="font-semibold text-zinc-900">
                    {((ing.amount * multiplier) || 0).toFixed(1).replace(/\.0$/, "")} {ing.unit || ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Steps</h4>
            <ol className="flex flex-col gap-3">
              {steps.map((step, idx) => (
                <li key={step.id} className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-zinc-800">{step.title}</span>
                    <span className="text-[12px] text-zinc-600 leading-relaxed">{step.content}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </AgentTimelineStep>
  );
}

export function RecommendClaudeAppsBlock({ tool }: { tool: AgentToolSegment }) {
  const appIds = (tool.args?.app_ids as string[]) ?? [];
  
  const appNames: Record<string, string> = {
    desktop: "Claude Desktop",
    ios: "Claude iOS App",
    android: "Claude Android App",
    claude_code_terminal: "Claude Code CLI",
    claude_code_vscode: "VS Code Extension",
    claude_code_jetbrains: "JetBrains Extension",
    claude_code_slack: "Slack Integration",
    excel: "Excel Add-in",
    powerpoint: "PowerPoint Add-in",
    chrome: "Chrome Extension",
  };

  return (
    <AgentTimelineStep icon="tool" isActive={tool.status === "running"} title="Recommended Apps">
      <div className="flex flex-col gap-2 max-w-md">
        {appIds.map((id) => (
          <div key={id} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm flex justify-between items-center">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-zinc-800">{appNames[id] || id}</span>
              <span className="text-[11px] text-zinc-400">Official ecosystem integration</span>
            </div>
            <button className="rounded-lg border border-zinc-200 text-zinc-700 text-[12px] font-semibold px-3 py-1.5 hover:bg-zinc-50">
              Get App
            </button>
          </div>
        ))}
      </div>
    </AgentTimelineStep>
  );
}

export function SuggestConnectorsBlock({ tool }: { tool: AgentToolSegment }) {
  const uuids = (tool.args?.uuids as string[]) ?? [];

  return (
    <AgentTimelineStep icon="tool" isActive={tool.status === "running"} title="Connect to Services">
      <div className="flex flex-col gap-2 max-w-md">
        {uuids.map((uuid) => (
          <div key={uuid} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm flex justify-between items-center">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-zinc-800">{uuid.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              <span className="text-[11px] text-zinc-400">MCP Connector</span>
            </div>
            <button className="rounded-lg bg-zinc-900 text-white text-[12px] font-semibold px-3 py-1.5 hover:bg-zinc-800">
              Connect
            </button>
          </div>
        ))}
      </div>
    </AgentTimelineStep>
  );
}

export function AgentToolBlock({ tool }: { tool: AgentToolSegment }) {
  if (tool.name === "web_search" || tool.name === "web_fetch") {
    return <AgentWebSearchBlock tool={tool} />;
  }
  if (
    tool.name === "create_file" ||
    tool.name === "present_files" ||
    tool.name === "file_write"
  ) {
    return <AgentFileBlock tool={tool} />;
  }
  if (tool.name === "bash_tool" || tool.name === "run_code_interpreter") {
    return <AgentBashToolBlock tool={tool} />;
  }
  if (tool.name === "ask_user_input_v0") {
    return <AskUserInputBlock tool={tool} />;
  }
  if (tool.name === "fetch_sports_data") {
    return <SportsDataBlock tool={tool} />;
  }
  if (tool.name === "image_search") {
    return <ImageSearchBlock tool={tool} />;
  }
  if (tool.name === "message_compose_v1") {
    return <MessageComposeBlock tool={tool} />;
  }
  if (tool.name === "places_map_display_v0") {
    return <MapDisplayBlock tool={tool} />;
  }
  if (tool.name === "recipe_display_v0") {
    return <RecipeDisplayBlock tool={tool} />;
  }
  if (tool.name === "recommend_clauxen_apps" || tool.name === "recommend_claude_apps") {
    return <RecommendClaudeAppsBlock tool={tool} />;
  }
  if (tool.name === "suggest_connectors") {
    return <SuggestConnectorsBlock tool={tool} />;
  }
  return <AgentGenericToolBlock tool={tool} />;
}
