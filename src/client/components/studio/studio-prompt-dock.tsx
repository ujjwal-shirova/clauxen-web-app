"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIOS,
  IMAGE_MODELS,
  VIDEO_DURATIONS,
  VIDEO_MODELS,
  VIDEO_RESOLUTIONS,
  type StudioAspectRatio,
  type StudioMode,
  type StudioVideoDuration,
  type StudioVideoResolution,
} from "./studio-types";

type StudioPromptDockProps = {
  mode: StudioMode;
  prompt: string;
  model: string;
  aspectRatio: StudioAspectRatio;
  duration: StudioVideoDuration;
  resolution: StudioVideoResolution;
  generating: boolean;
  dockFocused: boolean;
  referenceName: string | null;
  onPromptChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onAspectChange: (value: StudioAspectRatio) => void;
  onDurationChange: (value: StudioVideoDuration) => void;
  onResolutionChange: (value: StudioVideoResolution) => void;
  onReferenceChange: (file: File | null) => void;
  onFocusChange: (focused: boolean) => void;
  onGenerate: () => void;
};

export function StudioPromptDock({
  mode,
  prompt,
  model,
  aspectRatio,
  duration,
  resolution,
  generating,
  dockFocused,
  referenceName,
  onPromptChange,
  onModelChange,
  onAspectChange,
  onDurationChange,
  onResolutionChange,
  onReferenceChange,
  onFocusChange,
  onGenerate,
}: StudioPromptDockProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const models = mode === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const canGenerate = prompt.trim().length > 0 && !generating;

  return (
    <div
      className={cn(
        "studio-prompt-dock shrink-0 border-t border-white/[0.06] bg-[#0c0b09]/95 px-3 py-3 backdrop-blur-md transition-[box-shadow] duration-300 sm:px-4",
        dockFocused && "studio-dock-focused",
      )}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="studio-chip-select"
            aria-label="Model"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-md bg-white/[0.04] p-0.5">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectChange(ratio)}
                className={cn(
                  "rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
                  aspectRatio === ratio
                    ? "bg-white/[0.1] text-[#e8d4b0]"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          {mode === "video" ? (
            <>
              <div className="flex items-center gap-1 rounded-md bg-white/[0.04] p-0.5">
                {VIDEO_DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDurationChange(d)}
                    className={cn(
                      "rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
                      duration === d
                        ? "bg-white/[0.1] text-[#e8d4b0]"
                        : "text-white/40 hover:text-white/70",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-md bg-white/[0.04] p-0.5">
                {VIDEO_RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onResolutionChange(r)}
                    className={cn(
                      "rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
                      resolution === r
                        ? "bg-white/[0.1] text-[#e8d4b0]"
                        : "text-white/40 hover:text-white/70",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:border-white/15 hover:text-white/75",
              referenceName && "border-[#c4a574]/35 text-[#e8d4b0]",
            )}
          >
            <ImagePlus className="size-3.5" strokeWidth={1.5} />
            {referenceName ? (
              <span className="max-w-[100px] truncate">{referenceName}</span>
            ) : (
              "Reference"
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onReferenceChange(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGenerate) {
                e.preventDefault();
                onGenerate();
              }
            }}
            rows={2}
            placeholder={
              mode === "image"
                ? "Describe the image you want to create…"
                : "Describe the shot, motion, and mood…"
            }
            className="min-h-[52px] flex-1 resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] leading-relaxed text-[#f2ebe0] placeholder:text-white/30 outline-none transition-colors focus:border-[#c4a574]/40 focus:bg-white/[0.055]"
          />
          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            className={cn(
              "inline-flex h-[52px] shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-all duration-200",
              canGenerate
                ? "bg-[#c4a574] text-[#1a1510] hover:bg-[#d4b584] active:scale-[0.98]"
                : "cursor-not-allowed bg-white/[0.06] text-white/30",
            )}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" strokeWidth={1.75} />
            )}
            Generate
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-white/25">
          ⌘/Ctrl + Enter to generate · Frontend preview — generation API coming later
        </p>
      </div>
    </div>
  );
}
