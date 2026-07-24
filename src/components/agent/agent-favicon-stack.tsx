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
          "flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-100 text-zinc-500",
          className,
        )}
      >
        <Globe className="h-3 w-3" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <img
      src={faviconUrl(url)}
      alt=""
      className={cn(
        "h-5 w-5 rounded-full border border-white bg-white object-cover",
        className,
      )}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

export function AgentFaviconStack({ urls }: { urls: string[] }) {
  const unique = [...new Set(urls.filter(Boolean))].slice(0, 3);
  if (unique.length === 0) return null;

  return (
    <span className="inline-flex items-center pr-1">
      {unique.map((url, index) => (
        <FaviconCircle
          key={url}
          url={url}
          className={index > 0 ? "-ml-2" : undefined}
        />
      ))}
    </span>
  );
}
