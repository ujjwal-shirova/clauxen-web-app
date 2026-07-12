"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
import {
  LoaderCircle,
  Check,
  Copy,
  ExternalLink,
  ArrowUp,
  Plus,
  Calendar,
  MapPin,
  Star,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Droplets,
  Wind,
  Compass,
  ShieldAlert,
  Award,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  domainFromUrl,
  type AgentToolSegment,
  type WebSearchResult,
} from "@/frontend/lib/agent-segments";
import { AgentTimelineStep } from "./agent-timeline";
import { AgentFaviconStack } from "./agent-favicon-stack";
import { AgentFileBlock, PresentFilesBlock } from "./agent-file-block";
import {
  AskUserInputCard,
  type AskUserQuestion,
} from "./ask-user-input-card";
import { HighlightCode } from "@/frontend/lib/syntax-highlight";
import { StreamingTextFade } from "@/frontend/lib/streaming-text-fade";

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
  const [visibleCount, setVisibleCount] = useState(() =>
    tool.status === "running" ? 0 : results.length,
  );
  const prevLengthRef = useRef(results.length);

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
        <div className="rounded-[12px] border border-zinc-200 bg-background px-2 py-2">
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

type ImageSearchResult = {
  url: string;
  thumbnail: string;
  alt: string;
  landingUrl: string;
  creator?: string;
  license?: string;
};

export function ImageSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const query = typeof tool.args?.query === "string" ? tool.args.query : "";

  const parsed = useMemo(() => {
    if (!tool.result) return null;
    try {
      return JSON.parse(tool.result) as {
        images?: ImageSearchResult[];
        error?: string;
      };
    } catch {
      return null;
    }
  }, [tool.result]);

  const images = parsed?.images ?? [];

  return (
    <AgentTimelineStep
      icon="tool"
      isActive={isRunning}
      title={
        <span className={cn(isRunning && "shimmer-text")}>
          {query ? `Image search: ${query}` : "Image search"}
        </span>
      }
    >
      {isRunning ? (
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Searching…
        </div>
      ) : parsed?.error ? (
        <div className="text-[13px] text-red-600">{parsed.error}</div>
      ) : images.length === 0 ? (
        <div className="text-[13px] text-zinc-500">No images found.</div>
      ) : (
        <div className="grid max-w-md grid-cols-3 gap-2">
          {images.map((img, i) => (
            <a
              key={`${img.url}-${i}`}
              href={img.landingUrl || img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
              title={img.creator ? `By ${img.creator}${img.license ? ` (${img.license})` : ""}` : img.alt}
            >
              <img
                src={img.thumbnail || img.url}
                alt={img.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {img.creator ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {img.creator}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      )}
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

type WeatherIconKind = typeof Sun;

/** WMO weather interpretation codes -> icon. Mirrors the label mapping the
 * backend computes in open-meteo.ts (kept separate; icon choice is a
 * frontend-only concern, no need to share the module across the boundary). */
function weatherIconFor(code: number, isDay = true): WeatherIconKind {
  if (code === 0) return isDay ? Sun : Moon;
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

function formatHourLabel(iso: string): string {
  const hour = parseInt(iso.split("T")[1]?.slice(0, 2) ?? "0", 10);
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

type WeatherForecastData = {
  place: { name: string; admin1?: string; country?: string };
  units: "metric" | "imperial";
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    isDay: boolean;
    weatherCode: number;
    condition: string;
    windSpeed: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    precipitationProbability: number;
    weatherCode: number;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number;
    condition: string;
    tempMax: number;
    tempMin: number;
    precipitationProbability: number;
  }>;
};

export function WeatherBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const locationName =
    typeof tool.args?.location_name === "string" ? tool.args.location_name : "";

  const parsed = useMemo(() => {
    if (!tool.result) return null;
    try {
      const data = JSON.parse(tool.result) as
        | WeatherForecastData
        | { error: string };
      return data;
    } catch {
      return null;
    }
  }, [tool.result]);

  if (isRunning || !parsed) {
    return (
      <AgentTimelineStep
        icon="tool"
        isActive={isRunning}
        title={
          <span className={cn(isRunning && "shimmer-text")}>
            {isRunning
              ? `Checking the weather${locationName ? ` in ${locationName}` : ""}`
              : "Weather"}
          </span>
        }
      >
        {isRunning ? (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Fetching forecast…
          </div>
        ) : null}
      </AgentTimelineStep>
    );
  }

  if ("error" in parsed) {
    return (
      <AgentTimelineStep icon="tool" title="Weather">
        <div className="text-[13px] text-red-600">{parsed.error}</div>
      </AgentTimelineStep>
    );
  }

  const { place, current, hourly, daily, units } = parsed;
  const tempUnit = units === "imperial" ? "°F" : "°C";
  const windUnit = units === "imperial" ? "mph" : "km/h";
  const placeLabel = [place.name, place.admin1, place.country]
    .filter(Boolean)
    .join(", ");
  const CurrentIcon = weatherIconFor(current.weatherCode, current.isDay);

  return (
    <AgentTimelineStep icon="tool" title={placeLabel || locationName || "Weather"}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between bg-gradient-to-br from-sky-50 to-white p-4">
          <div className="flex items-center gap-3">
            <CurrentIcon className="h-10 w-10 shrink-0 text-sky-600" strokeWidth={1.5} />
            <div>
              <div className="text-[32px] font-semibold leading-none text-zinc-900">
                {Math.round(current.temperature)}
                {tempUnit}
              </div>
              <div className="text-[13px] text-zinc-500">
                {current.condition} · Feels like {Math.round(current.feelsLike)}
                {tempUnit}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-[12px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5" /> {Math.round(current.humidity)}%
            </span>
            <span className="flex items-center gap-1">
              <Wind className="h-3.5 w-3.5" /> {Math.round(current.windSpeed)} {windUnit}
            </span>
          </div>
        </div>

        {hourly.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto border-t border-zinc-100 px-4 py-3">
            {hourly.slice(0, 12).map((hour) => {
              const HourIcon = weatherIconFor(hour.weatherCode);
              return (
                <div
                  key={hour.time}
                  className="flex shrink-0 flex-col items-center gap-1 text-[11px] text-zinc-500"
                >
                  <span>{formatHourLabel(hour.time)}</span>
                  <HourIcon className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                  <span className="font-semibold text-zinc-800">
                    {Math.round(hour.temperature)}°
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {daily.map((day) => {
            const DayIcon = weatherIconFor(day.weatherCode);
            return (
              <div
                key={day.date}
                className="flex items-center justify-between gap-2 px-4 py-2 text-[13px]"
              >
                <span className="w-10 shrink-0 text-zinc-600">
                  {formatDayLabel(day.date)}
                </span>
                <DayIcon className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.5} />
                <span className="flex-1 text-right text-[12px] text-zinc-400">
                  {Math.round(day.precipitationProbability)}%
                </span>
                <span className="w-8 shrink-0 text-right font-medium text-zinc-800">
                  {Math.round(day.tempMax)}°
                </span>
                <span className="w-8 shrink-0 text-right text-zinc-400">
                  {Math.round(day.tempMin)}°
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AgentTimelineStep>
  );
}

type PlaceSearchResult = {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
  type?: string;
  address?: { road?: string; city?: string; state?: string; country?: string };
};

function osmLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

export function PlacesSearchBlock({ tool }: { tool: AgentToolSegment }) {
  const isRunning = tool.status === "running";
  const query =
    typeof tool.args?.query === "string" ? tool.args.query : "";

  const parsed = useMemo(() => {
    if (!tool.result) return null;
    try {
      return JSON.parse(tool.result) as {
        results?: PlaceSearchResult[];
        error?: string;
      };
    } catch {
      return null;
    }
  }, [tool.result]);

  const results = parsed?.results ?? [];

  return (
    <AgentTimelineStep
      icon="search"
      isActive={isRunning}
      title={
        <span className={cn(isRunning && "shimmer-text")}>
          {query ? `Searching places: ${query}` : "Searching places"}
        </span>
      }
      trailing={!isRunning && results.length > 0 ? `${results.length} results` : undefined}
    >
      {isRunning ? (
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Searching…
        </div>
      ) : parsed?.error ? (
        <div className="text-[13px] text-red-600">{parsed.error}</div>
      ) : results.length === 0 ? (
        <div className="text-[13px] text-zinc-500">No places found.</div>
      ) : (
        <div className="flex max-w-md flex-col gap-2">
          {results.map((place, index) => (
            <a
              key={`${place.latitude}-${place.longitude}-${index}`}
              href={osmLink(place.latitude, place.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-zinc-800">
                  {place.name}
                </div>
                <div className="truncate text-[12px] text-zinc-500">
                  {place.displayName}
                </div>
              </div>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300" />
            </a>
          ))}
        </div>
      )}
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
  if (tool.name === "create_file" || tool.name === "file_write") {
    return <AgentFileBlock tool={tool} />;
  }
  if (tool.name === "present_files") {
    return <PresentFilesBlock tool={tool} />;
  }
  if (tool.name === "bash_tool" || tool.name === "run_code_interpreter") {
    return <AgentBashToolBlock tool={tool} />;
  }
  if (tool.name === "ask_user_input_v0") {
    return <AskUserInputBlock tool={tool} />;
  }
  if (tool.name === "weather_fetch") {
    return <WeatherBlock tool={tool} />;
  }
  if (tool.name === "places_search") {
    return <PlacesSearchBlock tool={tool} />;
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
