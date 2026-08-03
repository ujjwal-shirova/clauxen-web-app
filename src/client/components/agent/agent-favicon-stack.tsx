"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { domainFromUrl } from "@/lib/agent-segments";

function faviconUrl(url: string) {
  const domain = domainFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function FaviconCircle({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full border border-white bg-zinc-100 text-zinc-500",
          className,
        )}
      >
        <Globe className="h-2.5 w-2.5" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <img
      src={faviconUrl(url)}
      alt=""
      className={cn(
        "h-4 w-4 rounded-full border border-white bg-white object-cover",
        className,
      )}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Compact favicon cluster + optional "N sources" count beside a step label. */
export function AgentFaviconStack({
  urls,
  count,
}: {
  urls: string[];
  /** Override display count (defaults to unique url length). */
  count?: number;
}) {
  const unique = [...new Set(urls.filter(Boolean))];
  const shown = unique.slice(0, 4);
  const total = count ?? unique.length;
  if (shown.length === 0 && total <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {shown.length > 0 ? (
        <span className="inline-flex items-center">
          {shown.map((url, index) => (
            <FaviconCircle
              key={url}
              url={url}
              className={index > 0 ? "-ml-1.5" : undefined}
            />
          ))}
        </span>
      ) : null}
      {total > 0 ? (
        <span className="shrink-0 text-[12px] font-[430] tabular-nums leading-none text-zinc-400">
          {total} {total === 1 ? "source" : "sources"}
        </span>
      ) : null}
    </span>
  );
}
