"use client";

import { ChevronRight, FolderKanban, Star } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { formatRelativeTime } from "@/frontend/lib/format-relative-time";
import type { ApiProject } from "@/frontend/lib/api/projects";

type ProjectListRowProps = {
  project: ApiProject;
  starred?: boolean;
  onOpen: () => void;
  onToggleStar?: () => void;
};

export function ProjectListRow({
  project,
  starred = false,
  onOpen,
  onToggleStar,
}: ProjectListRowProps) {
  const updatedLabel = formatRelativeTime(project.updated_at);

  return (
    <li className="list-none">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-h-[68px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-left",
            "transition-colors active:bg-zinc-50",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
            <FolderKanban className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium leading-5 text-zinc-900">
              {project.name}
            </span>
            {project.description ? (
              <span className="mt-0.5 block truncate text-[13px] leading-4 text-zinc-500">
                {project.description}
              </span>
            ) : (
              <span className="mt-0.5 block text-[12px] leading-4 text-zinc-400">
                Updated {updatedLabel}
              </span>
            )}
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-zinc-300"
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {onToggleStar ? (
          <button
            type="button"
            aria-label={starred ? "Unstar project" : "Star project"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className={cn(
              "flex h-[68px] w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-colors active:bg-zinc-50",
              starred && "text-amber-600",
            )}
          >
            <Star
              className={cn("h-4 w-4", starred && "fill-current")}
              strokeWidth={1.75}
            />
          </button>
        ) : null}
      </div>
    </li>
  );
}
