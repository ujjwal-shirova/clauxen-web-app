"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function safeAccent(value: string | undefined): string {
  if (!value) return "#71717a";
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#71717a";
}

type PluginArtworkProps = {
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  size?: number;
  className?: string;
};

/** Plugin logo, or a letter on the plugin's brand color if the image is missing. */
export function PluginArtwork({
  name,
  logoUrl,
  brandColor,
  size = 40,
  className,
}: PluginArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (name || "P").slice(0, 1).toUpperCase();
  const showImage = Boolean(logoUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-zinc-200/80 bg-white text-[13px] font-medium text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? "#fff" : safeAccent(brandColor ?? undefined),
      }}
    >
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}
