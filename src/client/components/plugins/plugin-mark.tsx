"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type PluginMarkProps = {
  name: string;
  iconUrl?: string;
  size?: number;
  className?: string;
};

export function PluginMark({
  name,
  iconUrl,
  size = 40,
  className,
}: PluginMarkProps) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const showImage = Boolean(iconUrl) && !failed;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[var(--ui-border-subtle)] bg-white text-[13px] font-medium text-[var(--ui-fg-muted)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImage ? (
        // Remote marketplace artwork; next/image would need every CDN host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}
