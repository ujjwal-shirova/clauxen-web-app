"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Folder, FolderPlus, FolderX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import type { ApiProject } from "@/lib/api/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const CLAUXEN_OPEN_CREATE_PROJECT_EVENT = "clauxen-open-create-project";

const SELECTION_STORAGE_KEY = "clauxen-composer-project-id";

type Selection = string | null; // null = don't use project

function readStoredSelection(): Selection {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SELECTION_STORAGE_KEY);
    if (raw === null || raw === "" || raw === "none") return null;
    return raw;
  } catch {
    return null;
  }
}

function writeStoredSelection(next: Selection) {
  if (typeof window === "undefined") return;
  try {
    if (next == null) {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, "none");
    } else {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, next);
    }
  } catch {
    /* ignore */
  }
}

export function ComposerProjectStrip({
  className,
  lockedProjectId = null,
}: {
  className?: string;
  /** When the chat already belongs to a project, lock selection to it. */
  lockedProjectId?: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const { projects, loading } = useProjects(isAuthenticated);
  const [selectedId, setSelectedId] = useState<Selection>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (lockedProjectId) {
      setSelectedId(lockedProjectId);
      return;
    }
    setSelectedId(readStoredSelection());
  }, [lockedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const label = selectedProject?.name?.trim() || "Select project";
  const locked = Boolean(lockedProjectId);

  const choose = (next: Selection) => {
    if (locked) return;
    setSelectedId(next);
    writeStoredSelection(next);
    setOpen(false);
  };

  const openCreateProject = () => {
    setOpen(false);
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(CLAUXEN_OPEN_CREATE_PROJECT_EVENT));
  };

  return (
    <div
      className={cn(
        "composer-project-strip relative flex h-10 items-center border-t border-[var(--ui-border-subtle)] bg-[var(--ui-muted-surface)] px-3 sm:h-10 sm:px-4",
        className,
      )}
      data-composer-project-strip
    >
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild disabled={locked}>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 max-w-full items-center gap-2 rounded-full px-2 text-[13px] font-[430] text-[var(--ui-fg-muted)] transition-colors",
              !locked && "hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
              locked && "cursor-default",
            )}
            aria-label="Select project"
          >
            <Folder
              className="h-3.5 w-3.5 shrink-0 text-[var(--ui-fg-muted)]"
              strokeWidth={1.75}
            />
            <span className="min-w-0 truncate">
              {loading && !selectedProject ? "Select project" : label}
            </span>
            {!locked ? (
              <ChevronDown
                className="h-3 w-3 shrink-0 text-[var(--ui-fg-placeholder)]"
                strokeWidth={2}
              />
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={8}
          className="z-[120] w-[min(calc(100vw-2rem),260px)] rounded-[16px] border-[var(--popup-border)] bg-[var(--popup-bg)] p-1.5 shadow-[var(--popup-shadow)]"
        >
          <ProjectMenuRow
            icon={<FolderPlus className="h-4 w-4" strokeWidth={1.75} />}
            label="New project"
            onClick={openCreateProject}
          />
          <ProjectMenuRow
            icon={<FolderX className="h-4 w-4" strokeWidth={1.75} />}
            label="Don't use project"
            selected={selectedId == null}
            onClick={() => choose(null)}
          />
          {projects.length > 0 ? (
            <div className="my-1 h-px bg-[var(--ui-border-subtle)]" aria-hidden />
          ) : null}
          {projects.map((project) => (
            <ProjectMenuRow
              key={project.id}
              icon={<Folder className="h-4 w-4" strokeWidth={1.75} />}
              label={project.name || "Untitled project"}
              selected={selectedId === project.id}
              onClick={() => choose(project.id)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ProjectMenuRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] font-[430] text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]",
        selected && "bg-[var(--ui-hover-wash)]",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--ui-fg-muted)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-[var(--link)]" strokeWidth={2.25} />
      ) : null}
    </button>
  );
}

export type { ApiProject };
