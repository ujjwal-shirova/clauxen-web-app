"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Clock,
  FileText,
  FolderKanban,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  SquarePen,
  Trash,
} from "@/components/icons/app-icons";
import { AppHref } from "@/components/app-href";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { APP_ROUTES } from "@/lib/app-routes";
import { appBtn } from "@/lib/app-buttons";
import {
  deleteProject,
  listProjects,
  updateProject,
  type ProjectLifecycle,
  type ProjectListItem,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { ProjectMark } from "./project-icon";
import { CreateProjectDialog, ProjectDetailsDialog } from "./project-dialogs";
import { relativeDate } from "./project-format";

type ViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "clauxen_projects_view";

function useViewMode() {
  const [mode, setMode] = useState<ViewMode>("grid");

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "list") setMode(stored);
  }, []);

  return [
    mode,
    (next: ViewMode) => {
      setMode(next);
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    },
  ] as const;
}

function ProjectActions({
  project,
  onChanged,
  onEdit,
  align = "end",
}: {
  project: ProjectListItem;
  onChanged: () => void;
  onEdit: () => void;
  align?: "start" | "end";
}) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setConfirmDelete(false)}>
      <DropdownMenuTrigger
        aria-label={`Actions for ${project.name}`}
        onClick={(event) => event.stopPropagation()}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[17px] text-[var(--ui-fg-muted)] outline-none transition hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:opacity-100 data-[state=open]:bg-[var(--ui-hover-wash)] data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem onSelect={onEdit}>
          <SquarePen className="text-[15px]" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void updateProject(project.id, { pinned: !project.pinned }).then(
              onChanged,
            );
          }}
        >
          {project.pinned ? (
            <PinOff className="text-[15px]" />
          ) : (
            <Pin className="text-[15px]" />
          )}
          {project.pinned ? "Unpin from top" : "Pin to top"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void updateProject(project.id, { archived: !project.archived })
              .then(onChanged)
              .then(() =>
                toast({
                  title: project.archived
                    ? "Project restored"
                    : "Project archived",
                }),
              );
          }}
        >
          {project.archived ? (
            <ArchiveRestore className="text-[15px]" />
          ) : (
            <Archive className="text-[15px]" />
          )}
          {project.archived ? "Restore project" : "Archive project"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600"
          onSelect={(event) => {
            if (!confirmDelete) {
              event.preventDefault();
              setConfirmDelete(true);
              return;
            }
            void deleteProject(project.id)
              .then(onChanged)
              .then(() => toast({ title: "Project deleted" }));
          }}
        >
          <Trash className="text-[15px]" />
          {confirmDelete ? "Click again to confirm" : "Delete project"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectMeta({ project }: { project: ProjectListItem }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-[var(--ui-fg-subtle)]">
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="text-[14px]" />
        {project.chatCount}
      </span>
      <span className="inline-flex items-center gap-1">
        <FileText className="text-[14px]" />
        {project.sourceCount}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="text-[14px]" />
        {relativeDate(project.updatedAt)}
      </span>
    </div>
  );
}

function ProjectCard({
  project,
  onChanged,
  onEdit,
}: {
  project: ProjectListItem;
  onChanged: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-4 transition hover:border-[var(--ui-border)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]">
      <AppHref
        href={APP_ROUTES.project(project.id)}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0 rounded-2xl"
      />
      <div className="relative z-10 flex items-start gap-3">
        <ProjectMark icon={project.icon} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="flex items-center gap-1.5 truncate text-[15px] font-medium tracking-[-0.01em] text-[var(--ui-fg)]">
            <span className="truncate">{project.name}</span>
            {project.pinned ? (
              <Pin className="shrink-0 text-[13px] text-[var(--ui-fg-subtle)]" />
            ) : null}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
            {project.description || "No description yet."}
          </p>
        </div>
        <span className="relative z-20">
          <ProjectActions
            project={project}
            onChanged={onChanged}
            onEdit={onEdit}
          />
        </span>
      </div>
      <div className="relative z-10 pointer-events-none mt-auto">
        <ProjectMeta project={project} />
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onChanged,
  onEdit,
}: {
  project: ProjectListItem;
  onChanged: () => void;
  onEdit: () => void;
}) {
  return (
    <li className="group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-[var(--ui-hover-wash)]">
      <AppHref
        href={APP_ROUTES.project(project.id)}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0 rounded-xl"
      />
      <span className="relative z-10 pointer-events-none">
        <ProjectMark icon={project.icon} size="md" />
      </span>
      <div className="relative z-10 pointer-events-none min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[var(--ui-fg)]">
          <span className="truncate">{project.name}</span>
          {project.pinned ? (
            <Pin className="shrink-0 text-[12px] text-[var(--ui-fg-subtle)]" />
          ) : null}
        </p>
        <p className="truncate text-[12.5px] text-[var(--ui-fg-muted)]">
          {project.description || "No description yet."}
        </p>
      </div>
      <div className="relative z-10 pointer-events-none hidden sm:block">
        <ProjectMeta project={project} />
      </div>
      <span className="relative z-20">
        <ProjectActions
          project={project}
          onChanged={onChanged}
          onEdit={onEdit}
        />
      </span>
    </li>
  );
}

export function ProjectsGallery() {
  const { isMobile, openMobileNav } = useAppLayout();
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle>("active");
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useViewMode();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const reload = () => {
    void listProjects(lifecycle)
      .then((result) => setProjects(result.projects))
      .catch(() => setProjects([]));
  };

  useEffect(() => {
    setProjects(null);
    void listProjects(lifecycle)
      .then((result) => setProjects(result.projects))
      .catch(() => setProjects([]));
  }, [lifecycle]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!projects) return [];
    if (!term) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term),
    );
  }, [projects, search]);

  const editProject = projects?.find((project) => project.id === editId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader
          title="Projects"
          onOpenMobileNav={openMobileNav}
          borderless
          trailing={
            <button
              type="button"
              aria-label="New project"
              className="flex size-8 items-center justify-center rounded-lg text-[18px] text-[var(--ui-fg)] hover:bg-[var(--ui-hover-wash)]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus />
            </button>
          }
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[var(--ui-page-max-width-wide)] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {!isMobile ? (
                <h1 className="text-[28px] font-medium tracking-[-0.04em] text-[var(--ui-fg)]">
                  Projects
                </h1>
              ) : null}
              <p className="mt-1 text-[13.5px] text-[var(--ui-fg-muted)]">
                Group chats, files, instructions and memory around a single
                piece of work.
              </p>
            </div>
            {!isMobile ? (
              <button
                type="button"
                className={cn(appBtn.primary, "gap-1.5")}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="text-[16px]" />
                New project
              </button>
            ) : null}
          </header>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-full bg-[var(--ui-hover-wash)] p-0.5">
              {(
                [
                  ["active", "Active"],
                  ["archived", "Archived"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={lifecycle === id}
                  onClick={() => setLifecycle(id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] transition",
                    lifecycle === id
                      ? "bg-[var(--ui-card-bg)] font-medium text-[var(--ui-fg)] shadow-sm"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="relative ml-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-[var(--ui-fg-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="h-9 w-full min-w-[180px] rounded-full border border-[var(--ui-border)] bg-transparent pl-9 pr-3 text-[13px] text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)] sm:w-56"
              />
            </label>

            <div className="flex items-center gap-0.5 rounded-full bg-[var(--ui-hover-wash)] p-0.5">
              {(
                [
                  ["grid", "Grid view", LayoutGrid],
                  ["list", "List view", LayoutList],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-[16px] transition",
                    view === id
                      ? "bg-[var(--ui-card-bg)] text-[var(--ui-fg)] shadow-sm"
                      : "text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                  )}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          {projects === null ? (
            <div
              className={cn(
                "mt-6",
                view === "grid"
                  ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-1",
              )}
            >
              {Array.from({ length: view === "grid" ? 6 : 5 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "animate-pulse rounded-2xl bg-[var(--ui-hover-wash)]",
                    view === "grid" ? "h-[132px]" : "h-[60px]",
                  )}
                />
              ))}
            </div>
          ) : visible.length ? (
            view === "grid" ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onChanged={reload}
                    onEdit={() => setEditId(project.id)}
                  />
                ))}
              </div>
            ) : (
              <ul className="mt-5 flex flex-col">
                {visible.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onChanged={reload}
                    onEdit={() => setEditId(project.id)}
                  />
                ))}
              </ul>
            )
          ) : (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[var(--ui-border)] px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--ui-hover-wash)] text-[22px] text-[var(--ui-fg-muted)]">
                {lifecycle === "archived" ? <Archive /> : <FolderKanban />}
              </span>
              <p className="mt-4 text-[16px] font-medium text-[var(--ui-fg)]">
                {search.trim()
                  ? "No projects match that search"
                  : lifecycle === "archived"
                    ? "Nothing archived"
                    : "No projects yet"}
              </p>
              <p className="mt-1 max-w-sm text-[13.5px] leading-6 text-[var(--ui-fg-muted)]">
                {search.trim()
                  ? "Try a different term, or check the other tab."
                  : lifecycle === "archived"
                    ? "Archived projects stay out of the way but keep all their chats and files."
                    : "Create a project to keep a body of work — its chats, files, instructions and memory — in one place."}
              </p>
              {!search.trim() && lifecycle === "active" ? (
                <button
                  type="button"
                  className={cn(appBtn.primary, "mt-5 gap-1.5")}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="text-[16px]" />
                  New project
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editProject ? (
        <ProjectDetailsDialog
          project={editProject}
          open
          onOpenChange={(open) => {
            if (!open) setEditId(null);
          }}
          onUpdated={() => {
            setEditId(null);
            reload();
          }}
          onDeleted={() => {
            setEditId(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
