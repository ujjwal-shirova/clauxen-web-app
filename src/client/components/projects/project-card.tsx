"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Star,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { ApiProject } from "@/lib/api/projects";
import { ProjectAvatar } from "@/components/projects/project-avatar";

function ProjectMenuRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px] leading-5 outline-none",
        destructive
          ? "text-[#8e2626] focus:bg-[#8e2626]/8 focus:text-[#8e2626]"
          : "text-zinc-900 focus:bg-[rgba(11,11,11,0.06)]",
      )}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <Icon
        className={cn(
          "icon-md shrink-0",
          destructive ? "text-[#8e2626]" : "text-zinc-700",
        )}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </DropdownMenuItem>
  );
}

type ProjectCardProps = {
  project: ApiProject;
  starred?: boolean;
  onOpen: () => void;
  onToggleStar?: () => void;
  onEditDetails?: () => void;
  onDelete?: () => void;
};

export function ProjectCard({
  project,
  starred = false,
  onOpen,
  onToggleStar,
  onEditDetails,
  onDelete,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const updatedLabel = formatRelativeTime(project.updated_at);

  return (
    <li className="relative h-full min-w-0 list-none">
      <div className="group relative h-full transition-transform duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex h-full min-h-[148px] w-full flex-col gap-3 rounded-[var(--radius-md)] border border-zinc-200/90 bg-white p-4 text-left",
            "outline-none transition-[border-color,box-shadow] duration-150 hover:border-zinc-300 hover:shadow-[0_2px_10px_rgba(24,24,27,0.05)]",
            "focus-visible:ring-2 focus-visible:ring-zinc-900/15",
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden pr-10">
            <ProjectAvatar
              icon={project.icon}
              color={project.color}
              name={project.name}
              size="md"
            />
            <div className="min-w-0 truncate text-[14px] font-medium leading-5 text-zinc-900">
              {project.name}
            </div>
          </div>
          {project.description ? (
            <div className="line-clamp-3 flex-1 overflow-hidden text-[14px] leading-5 text-zinc-600">
              {project.description}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="mt-auto text-[12px] leading-4 text-zinc-500">
            <span>Updated </span>
            <time dateTime={project.updated_at}>{updatedLabel}</time>
          </div>
        </button>

        <div
          className={cn(
            "absolute right-3 top-3 z-10 transition-opacity duration-150",
            menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More options for ${project.name}`}
                onClick={(e) => e.stopPropagation()}
                className="ui-icon-button no-hover-overlay text-zinc-500"
              >
                <MoreHorizontal className="icon-md" strokeWidth={1.75} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="min-w-[130px] rounded-xl border border-[rgba(11,11,11,0.1)] bg-white p-1 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <ProjectMenuRow
                icon={Star}
                label={starred ? "Unpin" : "Pin"}
                onClick={() => {
                  onToggleStar?.();
                  setMenuOpen(false);
                }}
              />
              <ProjectMenuRow
                icon={Pencil}
                label="Open project"
                onClick={() => {
                  onEditDetails?.();
                  setMenuOpen(false);
                }}
              />
              <DropdownMenuSeparator className="mx-2.5 my-1 bg-[rgba(11,11,11,0.1)]" />
              <ProjectMenuRow
                icon={Trash2}
                label="Delete"
                destructive
                onClick={() => {
                  onDelete?.();
                  setMenuOpen(false);
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
