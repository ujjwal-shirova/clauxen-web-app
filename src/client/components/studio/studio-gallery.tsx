"use client";

import type { ReactNode } from "react";
import { Clapperboard, Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioGeneration, StudioMode, StudioSection } from "./studio-types";

type StudioGalleryProps = {
  section: StudioSection;
  mode: StudioMode;
  generations: StudioGeneration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function aspectClass(ratio: StudioGeneration["aspectRatio"]) {
  switch (ratio) {
    case "1:1":
      return "aspect-square";
    case "16:9":
      return "aspect-video";
    case "9:16":
      return "aspect-[9/16]";
    case "4:3":
      return "aspect-[4/3]";
    case "3:4":
      return "aspect-[3/4]";
    default:
      return "aspect-video";
  }
}

export function StudioGallery({
  section,
  mode,
  generations,
  selectedId,
  onSelect,
}: StudioGalleryProps) {
  if (section === "assets") {
    return (
      <EmptyPanel
        icon={<ImageIcon className="size-8 text-white/25" strokeWidth={1.25} />}
        title="No saved assets yet"
        body="Generations you keep will show up here. Create something from Image or Video to get started."
      />
    );
  }

  if (section === "projects") {
    return (
      <EmptyPanel
        icon={<Film className="size-8 text-white/25" strokeWidth={1.25} />}
        title="Projects coming soon"
        body="Organize shoots and sequences into projects. Your current session lives in Untitled project."
      />
    );
  }

  const visible = generations.filter((g) => g.mode === mode);

  if (visible.length === 0) {
    return (
      <EmptyPanel
        icon={
          <Clapperboard
            className="size-8 text-[#c4a574]/50"
            strokeWidth={1.25}
          />
        }
        title={mode === "image" ? "Compose an image" : "Compose a video"}
        body="Write a prompt in the dock below, pick a model and aspect, then hit Generate. Results appear here."
      />
    );
  }

  return (
    <div className="studio-gallery-grid grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            "studio-gallery-item group relative overflow-hidden rounded-lg border text-left transition-all duration-300",
            selectedId === item.id
              ? "border-[#c4a574]/55 ring-1 ring-[#c4a574]/35"
              : "border-white/[0.06] hover:border-white/15",
            item.status === "pending" && "studio-gallery-pending",
          )}
        >
          <div
            className={cn(
              "relative w-full overflow-hidden bg-[#161410]",
              aspectClass(item.aspectRatio),
            )}
            style={{ backgroundImage: item.thumbGradient }}
          >
            {item.status === "pending" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                <span className="studio-shimmer h-1.5 w-24 rounded-full bg-white/20" />
              </div>
            ) : null}
            {item.mode === "video" && item.status === "ready" ? (
              <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                {item.duration ?? "8s"} · {item.resolution ?? "1080p"}
              </span>
            ) : null}
          </div>
          <div className="space-y-0.5 px-2.5 py-2">
            <p className="line-clamp-2 text-[12px] leading-snug text-white/75">
              {item.prompt || "Untitled"}
            </p>
            <p className="truncate text-[10px] text-white/35">{item.model}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full min-h-[280px] flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
        {icon}
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-[#f2ebe0]">
        {title}
      </h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/45">
        {body}
      </p>
    </div>
  );
}
