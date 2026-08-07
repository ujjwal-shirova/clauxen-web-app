"use client";

import { Download, X } from "lucide-react";
import type { StudioGeneration } from "./studio-types";

type StudioDetailDrawerProps = {
  generation: StudioGeneration | null;
  onClose: () => void;
};

export function StudioDetailDrawer({
  generation,
  onClose,
}: StudioDetailDrawerProps) {
  if (!generation) return null;

  return (
    <aside className="studio-detail-drawer flex w-[280px] shrink-0 flex-col border-l border-white/[0.06] bg-[#0e0d0b]">
      <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[12px] font-semibold text-white/70">Details</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
          aria-label="Close details"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div
          className="mb-3 aspect-video w-full overflow-hidden rounded-lg border border-white/[0.06]"
          style={{ backgroundImage: generation.thumbGradient }}
        />

        <dl className="space-y-3 text-[12px]">
          <div>
            <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              Prompt
            </dt>
            <dd className="leading-relaxed text-white/75">{generation.prompt}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              Model
            </dt>
            <dd className="text-white/70">{generation.model}</dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Aspect
              </dt>
              <dd className="text-white/70">{generation.aspectRatio}</dd>
            </div>
            <div>
              <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Status
              </dt>
              <dd className="capitalize text-white/70">{generation.status}</dd>
            </div>
          </div>
          {generation.mode === "video" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Duration
                </dt>
                <dd className="text-white/70">{generation.duration}</dd>
              </div>
              <div>
                <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Resolution
                </dt>
                <dd className="text-white/70">{generation.resolution}</dd>
              </div>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <button
          type="button"
          disabled={generation.status !== "ready"}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] py-2 text-[12px] font-medium text-white/50 transition-colors hover:border-white/15 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="size-3.5" strokeWidth={1.5} />
          Download
        </button>
      </div>
    </aside>
  );
}
