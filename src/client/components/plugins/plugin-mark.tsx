"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getPluginBrandIcon } from "./plugin-brand-icons";

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
  const brandIcon = getPluginBrandIcon(name, Math.round(size * 0.7));
  const showImage = Boolean(iconUrl) && !failed;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[var(--ui-border-subtle)] bg-white text-[13px] font-medium text-[var(--ui-fg-muted)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {brandIcon ? (
        brandIcon
      ) : showImage ? (
        // Remote marketplace artwork; next/image would need every CDN host.
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
