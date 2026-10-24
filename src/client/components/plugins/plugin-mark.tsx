"use client";

import { useState, useEffect } from "react";
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
  const [src, setSrc] = useState(iconUrl);

  useEffect(() => {
    setSrc(iconUrl);
    setFailed(false);
  }, [iconUrl]);

  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const showImage = Boolean(src) && !failed;

  const handleError = () => {
    if (src?.startsWith("https://cdn.clauxen.com/")) {
      const localPath = src.replace("https://cdn.clauxen.com", "/cdn");
      setSrc(localPath);
    } else {
      setFailed(true);
    }
  };

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-medium text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-0.5"
          onError={handleError}
        />
      ) : (
        <span className="font-semibold text-xs text-neutral-600 dark:text-neutral-400 select-none">
          {letter}
        </span>
      )}
    </span>
  );
}
