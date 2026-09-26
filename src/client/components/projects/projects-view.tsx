"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  FileText,
  Folder,
  Eye,
  Download,
  Lightbulb,
  Link2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Search,
  Settings,
  Share,
  Trash2,
  Upload,
} from "lucide-react";
import { AppHref } from "@/components/app-href";
import { IsolatedChatInput } from "@/components/isolated-chat-input";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { useToast } from "@/hooks/use-toast";
import { useChatSession } from "@/contexts/chat-session-context";
import { APP_ROUTES } from "@/lib/app-routes";
import { appBtn } from "@/lib/app-buttons";
import * as chatsApi from "@/lib/api/chats";
import { deleteUserFile, uploadUserFile } from "@/lib/api/files";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  type LibraryAccess,
  type ProjectChat,
  type ProjectDetail,
  type ProjectIcon,
  type ProjectMemory,
  type ProjectSource,
  type ProjectSummary,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { ProjectIconPicker, ProjectMark } from "./project-icon";

type ProjectTab = "all" | "mine" | "shared";
type SourceSort = "newest" | "oldest" | "alpha";
type SourceFilter = "all" | "files" | "saves" | "apps";

const fieldClass =
  "h-10 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] text-[14px] text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]";

function formatModified(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function MemoryMenu({
  value,
  onChange,
}: {
  value: ProjectMemory;
  onChange: (value: ProjectMemory) => void;
}) {
  const label = value === "project" ? "Project-only memory" : "Default memory";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-lg px-1 text-[14px] font-medium text-[var(--ui-fg)] outline-none hover:bg-[var(--ui-hover-wash)]">
        {label}
        <ChevronDown className="size-4 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-1">
        <MemoryOption
          title="Default memory"
          body="This project can access memory from outside chats, and vice versa."
          selected={value === "default"}
          onSelect={() => onChange("default")}
        />
        <MemoryOption
          title="Project-only memory"
          body="This project can only access its own memory. Its memory is hidden from outside chats."
          selected={value === "project"}
          onSelect={() => onChange("project")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemoryOption({
  title,
  body,
  selected,
  onSelect,
}: {
  title: string;
  body: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="items-start gap-2 whitespace-normal py-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--ui-fg)]">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-4 text-[var(--ui-fg-muted)]">{body}</span>
      </span>
      {selected ? <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> : <span className="size-4" />}
    </DropdownMenuItem>
  );
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useInstantNavigate();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<ProjectIcon>({ id: "folder", color: "#14151a" });
  const [memory, setMemory] = useState<ProjectMemory>("default");

  const reset = () => {
    setName("");
    setIcon({ id: "folder", color: "#14151a" });
    setMemory("default");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[480px] gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-medium tracking-[-0.03em]">
            Create project
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            void createProject({
              name: trimmed,
              iconId: icon.id,
              color: icon.color,
              memory,
            }).then((result) => {
              reset();
              onOpenChange(false);
              navigate(APP_ROUTES.project(result.project.id));
            });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-medium text-[var(--ui-fg)]">Project name</span>
            <span className="project-name-field relative">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2">
                <ProjectIconPicker
                  icon={icon}
                  onChange={setIcon}
                  triggerClassName="size-8"
                  glyphClassName="size-4"
                />
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Copenhagen Trip"
                autoFocus
                className={cn(fieldClass, "pl-11 pr-3")}
              />
            </span>
          </label>
          <div className="flex gap-2 rounded-xl bg-[var(--ui-hover-wash)] px-3 py-2.5 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
            <Lightbulb className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <p>
              Projects keep chats, files, and custom instructions in one place. Use them for ongoing work, or just to keep things tidy.
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <MemoryMenu value={memory} onChange={setMemory} />
            <button
              type="submit"
              disabled={!name.trim()}
              className={cn(appBtn.primary, "disabled:opacity-40")}
            >
              Create project
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  onUpdated,
}: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (project: ProjectSummary) => void;
}) {
  const navigate = useInstantNavigate();
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  useEffect(() => {
    setName(project.name);
    setInstructions(project.instructions);
  }, [project.id, project.name, project.instructions]);

  const save = (patch: Parameters<typeof updateProject>[1]) => {
    void updateProject(project.id, patch).then((result) => onUpdated(result.project));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-medium tracking-[-0.03em]">
            Project settings
          </DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium">Project name</span>
          <span className="project-name-field relative">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2">
              <ProjectIconPicker
                icon={project.icon}
                onChange={(icon) => save({ iconId: icon.id, color: icon.color })}
                triggerClassName="size-8"
                glyphClassName="size-4"
              />
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                const trimmed = name.trim();
                if (trimmed && trimmed !== project.name) save({ name: trimmed });
              }}
              className={cn(fieldClass, "pl-11 pr-3")}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium">Instructions</span>
          <span className="text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
            Set context and customize how Clauxen responds in this project.
          </span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            onBlur={() => {
              if (instructions !== project.instructions) save({ instructions });
            }}
            rows={4}
            placeholder='e.g. "Respond in Spanish. Reference the latest notes. Keep answers short and focused."'
            className="w-full resize-none rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2.5 text-[14px] leading-5 text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium">Memory</span>
          <MemorySelect
            value={project.memory}
            onChange={(memory) => save({ memory })}
          />
          <p className="text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
            {project.memory === "project"
              ? "This project can only access its own memory. Its memory is hidden from outside chats."
              : "This project can access memory from outside chats, and vice versa."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium">Library access</span>
          <LibrarySelect
            value={project.libraryAccess}
            onChange={(libraryAccess) => save({ libraryAccess })}
          />
          <p className="text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
            This project can access your file library while it remains private. Sharing this project disables library access.
          </p>
        </div>
        <button
          type="button"
          className="mt-1 h-9 w-fit rounded-full border border-red-500/40 px-4 text-[13px] font-medium text-red-600 hover:bg-red-500/10"
          onClick={() => {
            void deleteProject(project.id).then(() => {
              onOpenChange(false);
              navigate(APP_ROUTES.projects);
            });
          }}
        >
          Delete project
        </button>
      </DialogContent>
    </Dialog>
  );
}

function MemorySelect({
  value,
  onChange,
}: {
  value: ProjectMemory;
  onChange: (value: ProjectMemory) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-full items-center justify-between rounded-xl border border-[var(--ui-border)] px-3 text-[14px] outline-none">
        {value === "project" ? "Project-only memory" : "Default memory"}
        <ChevronDown className="size-4 text-[var(--ui-fg-muted)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[320px]">
        <MemoryOption
          title="Default memory"
          body="This project can access memory from outside chats, and vice versa."
          selected={value === "default"}
          onSelect={() => onChange("default")}
        />
        <MemoryOption
          title="Project-only memory"
          body="This project can only access its own memory. Its memory is hidden from outside chats."
          selected={value === "project"}
          onSelect={() => onChange("project")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LibrarySelect({
  value,
  onChange,
}: {
  value: LibraryAccess;
  onChange: (value: LibraryAccess) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-full items-center justify-between rounded-xl border border-[var(--ui-border)] px-3 text-[14px] outline-none">
        {value === "enabled" ? "Enabled" : "Disabled"}
        <ChevronDown className="size-4 text-[var(--ui-fg-muted)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px]">
        <DropdownMenuItem onSelect={() => onChange("enabled")}>
          Enabled
          {value === "enabled" ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange("disabled")}>
          Disabled
          {value === "disabled" ? <Check className="ml-auto size-4" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectsView() {
  const pathname = useAppPathname();
  const projectId = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  if (projectId) return <ProjectHome projectId={projectId} />;
  return <ProjectsIndex />;
}

function ProjectsIndex() {
  const { isMobile, openMobileNav } = useAppLayout();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ProjectTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const reload = () => {
    void listProjects()
      .then((result) => setProjects(result.projects))
      .catch(() => setProjects([]));
  };

  useEffect(() => {
    reload();
  }, []);

  const settingsProject = projects.find((project) => project.id === settingsId) ?? null;

  const visible = projects
    .filter((project) => {
      if (tab === "mine") return !project.shared;
      if (tab === "shared") return project.shared;
      return true;
    })
    .filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader title="Projects" onOpenMobileNav={openMobileNav} borderless />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[28px] font-medium tracking-[-0.04em] text-[var(--ui-fg)]">
              Projects
            </h1>
            <div className="flex items-center gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ui-fg-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  className="h-9 w-52 rounded-full border border-[var(--ui-border)] bg-transparent pl-9 pr-3 text-[13px] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]"
                />
              </label>
              <button type="button" className={cn(appBtn.primarySm, "rounded-full px-4")} onClick={() => setCreateOpen(true)}>
                New
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-1 text-[14px]">
            {(
              [
                ["all", "All"],
                ["mine", "Created by you"],
                ["shared", "Shared with you"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-full px-3 py-1.5",
                  tab === id
                    ? "bg-[var(--ui-hover-wash)] font-medium text-[var(--ui-fg)]"
                    : "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="mt-8">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_36px] px-3 pb-2 text-[13px] text-[var(--ui-fg-muted)]">
                <span>Name</span>
                <span>Modified</span>
                <span />
              </div>
              <ul className="flex flex-col">
                {visible.map((project) => (
                  <li key={project.id} className="group">
                    <div className="grid grid-cols-[minmax(0,1fr)_88px_36px] items-center rounded-xl px-3 py-2.5 hover:bg-[var(--ui-hover-wash)]">
                      <AppHref href={APP_ROUTES.project(project.id)} className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg border border-[var(--ui-border-subtle)]">
                          <ProjectMark icon={project.icon} glyphClassName="size-4" />
                        </span>
                        <span className="truncate text-[14px] text-[var(--ui-fg)]">{project.name}</span>
                      </AppHref>
                      <span className="text-[13px] text-[var(--ui-fg-muted)]">
                        {formatModified(project.updatedAt)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${project.name}`}
                          className="flex size-8 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] opacity-0 outline-none hover:bg-[var(--ui-field-bg)] group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => {
                            void updateProject(project.id, { pinned: !project.pinned }).then(reload);
                          }}>
                            <Pin className="size-4" strokeWidth={1.75} />
                            {project.pinned ? "Unpin project" : "Pin project"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              const url = `${window.location.origin}${APP_ROUTES.project(project.id)}`;
                              void copyText(url).then((ok) =>
                                toast({ title: ok ? "Link copied" : "Could not copy link" }),
                              );
                            }}
                          >
                            <Share className="size-4" strokeWidth={1.75} />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setSettingsId(project.id)}>
                            <Settings className="size-4" strokeWidth={1.75} />
                            Project settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={() => {
                              void deleteProject(project.id).then(reload);
                            }}
                          >
                            <Trash2 className="size-4" strokeWidth={1.75} />
                            Delete project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-24 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--ui-hover-wash)] text-[var(--ui-fg)]">
                <Folder className="size-5" strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-[16px] font-medium text-[var(--ui-fg)]">No matching projects</p>
              <p className="mt-1 text-[14px] text-[var(--ui-fg-muted)]">
                Try a different search or tab.
              </p>
              {!query && tab === "all" ? (
                <button type="button" className={cn(appBtn.primary, "mt-5")} onClick={() => setCreateOpen(true)}>
                  New project
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      {settingsProject ? (
        <ProjectSettingsDialog
          project={settingsProject}
          open
          onUpdated={(next) => {
            setProjects((current) =>
              current.map((row) => (row.id === next.id ? { ...row, ...next } : row)),
            );
          }}
          onOpenChange={(open) => {
            if (!open) setSettingsId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ProjectHome({ projectId }: { projectId: string }) {
  const { isMobile, openMobileNav } = useAppLayout();
  const { toast } = useToast();
  const navigate = useInstantNavigate();
  const session = useChatSession();
  const [project, setProject] = useState<ProjectDetail | null | undefined>(undefined);
  const [tab, setTab] = useState<"chats" | "sources">("chats");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [renameChat, setRenameChat] = useState<ProjectChat | null>(null);
  const [sort, setSort] = useState<SourceSort>("newest");
  const [filter, setFilter] = useState<SourceFilter>("all");

  const reload = () => {
    void getProject(projectId)
      .then((result) => setProject(result.project))
      .catch(() => setProject(null));
  };

  useEffect(() => {
    setProject(undefined);
    reload();
  }, [projectId]);

  if (project === undefined) return null;

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-[20px] font-medium text-[var(--ui-fg)]">Project not found</h1>
          <AppHref href={APP_ROUTES.projects} className={cn(appBtn.secondary, "mt-4 inline-flex")}>
            Back to projects
          </AppHref>
        </div>
      </div>
    );
  }

  const chats = [...project.chats].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  const sources = project.sources
    .filter((source) => {
      if (filter === "files") return source.kind === "file";
      if (filter === "saves") return source.kind === "text" || source.kind === "library";
      if (filter === "apps") return source.kind === "drive" || source.kind === "slack";
      return true;
    })
    .sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      if (sort === "oldest") return a.createdAt < b.createdAt ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader title={project.name} onOpenMobileNav={openMobileNav} borderless />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <ProjectIconPicker
              icon={project.icon}
              onChange={(icon) => {
                void updateProject(project.id, { iconId: icon.id, color: icon.color }).then(reload);
              }}
              triggerClassName="size-9"
              glyphClassName="size-6"
            />
            <h1 className="min-w-0 flex-1 truncate text-[26px] font-medium tracking-[-0.04em] text-[var(--ui-fg)]">
              {project.name}
            </h1>
            <button
              type="button"
              className={cn(appBtn.secondarySm, "rounded-full")}
              onClick={() => {
                const url = `${window.location.origin}${APP_ROUTES.project(project.id)}`;
                void copyText(url).then((ok) =>
                  toast({ title: ok ? "Link copied" : "Could not copy link" }),
                );
              }}
            >
              <Share className="size-3.5" strokeWidth={1.75} />
              Share
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Project actions" className="flex size-8 items-center justify-center rounded-full border border-[var(--ui-border)] outline-none hover:bg-[var(--ui-hover-wash)]">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings className="size-4" strokeWidth={1.75} />
                  Project settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void updateProject(project.id, { pinned: !project.pinned }).then(reload);
                  }}
                >
                  <Pin className="size-4" strokeWidth={1.75} />
                  {project.pinned ? "Unpin project" : "Pin project"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 w-full" data-prompt-root>
            <IsolatedChatInput
              placeholder={`New chat in ${project.name}`}
              isConversationStarted={false}
              isGenerating={false}
              focusKey={project.id}
              projectId={project.id}
              onStopGeneration={() => {}}
              onSendMessage={(prompt, options) => {
                if (!prompt.trim() && !options?.attachments?.length) return;
                void session.handleSendMessage(prompt, {
                  forceNewChat: true,
                  projectId: project.id,
                  attachments: options?.attachments,
                  onChatCreated: (chatId) => navigate(APP_ROUTES.chat(chatId)),
                });
              }}
            />
          </div>

          <div className="mt-4 flex gap-1">
            {(["chats", "sources"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[14px] capitalize",
                  tab === id
                    ? "bg-[var(--ui-hover-wash)] font-medium text-[var(--ui-fg)]"
                    : "text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)]",
                )}
              >
                {id === "chats" ? "Chats" : "Sources"}
              </button>
            ))}
          </div>

          {tab === "chats" ? (
            <ul className="mt-3 flex flex-col">
              {chats.length ? (
                chats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    project={project}
                    chat={chat}
                    onChanged={reload}
                    onRename={() => setRenameChat(chat)}
                    onOpen={() => navigate(APP_ROUTES.chat(chat.id))}
                  />
                ))
              ) : (
                <li className="px-2 py-8 text-[14px] text-[var(--ui-fg-muted)]">
                  Chats in this project will show up here.
                </li>
              )}
            </ul>
          ) : (
            <SourcesPanel
              sources={sources}
              sort={sort}
              filter={filter}
              onSort={setSort}
              onFilter={setFilter}
              onAdd={() => setSourcesOpen(true)}
              onRemove={(sourceId) => {
                void deleteUserFile(sourceId).then(reload);
              }}
            />
          )}
        </div>
      </div>
      <ProjectSettingsDialog
        project={project}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdated={() => reload()}
      />
      <AddSourcesDialog
        projectId={project.id}
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        onAdded={reload}
      />
      <RenameChatDialog
        chat={renameChat}
        onClose={() => setRenameChat(null)}
        onSave={(title) => {
          if (!renameChat) return;
          void chatsApi.updateChat(renameChat.id, { title }).then(() => {
            setRenameChat(null);
            reload();
          });
        }}
      />
    </div>
  );
}

function ChatRow({
  project,
  chat,
  onRename,
  onChanged,
  onOpen,
}: {
  project: ProjectSummary;
  chat: ProjectChat;
  onRename: () => void;
  onChanged: () => void;
  onOpen: () => void;
}) {
  const { toast } = useToast();
  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_72px_28px] items-center rounded-xl px-2 py-2.5 hover:bg-[var(--ui-hover-wash)]">
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <p className="truncate text-[14px] font-medium text-[var(--ui-fg)]">{chat.title}</p>
        <p className="truncate text-[13px] text-[var(--ui-fg-muted)]">{chat.preview}</p>
      </button>
      <span className="text-[12px] text-[var(--ui-fg-muted)]">{formatModified(chat.updatedAt)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Actions for ${chat.title}`} className="flex size-7 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] opacity-0 outline-none group-hover:opacity-100 data-[state=open]:opacity-100">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={() => {
              const url = `${window.location.origin}${APP_ROUTES.chat(chat.id)}`;
              void copyText(url).then((ok) => toast({ title: ok ? "Link copied" : "Could not copy link" }));
            }}
          >
            <Share className="size-4" strokeWidth={1.75} /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <Pencil className="size-4" strokeWidth={1.75} /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void (chat.pinned ? chatsApi.unpinChat(chat.id) : chatsApi.pinChat(chat.id)).then(onChanged);
            }}
          >
            <Pin className="size-4" strokeWidth={1.75} /> {chat.pinned ? "Unpin chat" : "Pin chat"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { void chatsApi.archiveChat(chat.id).then(onChanged); }}>
            <Archive className="size-4" strokeWidth={1.75} /> Archive
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => { void chatsApi.deleteChat(chat.id).then(onChanged); }}>
            <Trash2 className="size-4" strokeWidth={1.75} /> Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-[12px] text-[var(--ui-fg-muted)]">
            {project.name}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { void chatsApi.deleteChat(chat.id).then(onChanged); }}>
            <Folder className="size-4" strokeWidth={1.75} /> Remove from project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function SourcesPanel({
  sources,
  sort,
  filter,
  onSort,
  onFilter,
  onAdd,
  onRemove,
}: {
  sources: ProjectSource[];
  sort: SourceSort;
  filter: SourceFilter;
  onSort: (sort: SourceSort) => void;
  onFilter: (filter: SourceFilter) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-3 flex justify-end gap-2">
        <FilterMenu
          label={sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Alphabetical"}
          options={[
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["alpha", "Alphabetical"],
          ]}
          value={sort}
          onChange={(value) => onSort(value as SourceSort)}
        />
        <FilterMenu
          label={filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
          options={[
            ["all", "All"],
            ["files", "Files"],
            ["saves", "Saves"],
            ["apps", "Apps"],
          ]}
          value={filter}
          onChange={(value) => onFilter(value as SourceFilter)}
        />
      </div>
      {sources.length ? (
        <ul className="flex flex-col">
          {sources.map((source) => (
            <li key={source.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--ui-hover-wash)]">
              <FileText className="size-4 shrink-0 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-[14px]">{source.name}</span>
              <span className="text-[12px] text-[var(--ui-fg-muted)]">File</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${source.name}`}
                  className="flex size-7 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] opacity-0 outline-none group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    <Eye className="size-4" strokeWidth={1.75} /> View
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Download className="size-4" strokeWidth={1.75} /> Download
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Share className="size-4" strokeWidth={1.75} /> Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={() => onRemove(source.id)}
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--ui-border)] px-6 py-16 text-center">
          <p className="text-[16px] font-medium">Give Clauxen more context</p>
          <p className="mt-1 max-w-md text-[14px] leading-6 text-[var(--ui-fg-muted)]">
            Upload sources or add a note so chats in this project have something to work from.
          </p>
          <button type="button" className={cn(appBtn.primary, "mt-4 rounded-full")} onClick={onAdd}>
            Add sources
          </button>
        </div>
      )}
      {sources.length ? (
        <button type="button" className={cn(appBtn.secondarySm, "mt-3")} onClick={onAdd}>
          Add sources
        </button>
      ) : null}
    </div>
  );
}

function FilterMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--ui-hover-wash)] px-3 text-[13px] text-[var(--ui-fg)] outline-none">
        {label}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(([id, name]) => (
          <DropdownMenuItem key={id} onSelect={() => onChange(id)}>
            {name}
            {value === id ? <Check className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddSourcesDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<"drop" | "text" | "library">("drop");
  const [text, setText] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, sourceKind: string) => {
    setBusy(true);
    try {
      await uploadUserFile(file, {
        purpose: "project-source",
        projectId,
        sourceKind,
      });
      setText("");
      setLibraryName("");
      setMode("drop");
      onOpenChange(false);
      onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-medium tracking-[-0.03em]">Add sources</DialogTitle>
        </DialogHeader>
        {mode === "text" ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder="Paste or write a note for this project"
              className="w-full resize-none rounded-xl border border-[var(--ui-border)] px-3 py-2 text-[14px] outline-none"
            />
            <button
              type="button"
              disabled={!text.trim() || busy}
              className={cn(appBtn.primarySm, "self-end disabled:opacity-40")}
              onClick={() => {
                const note = text.trim();
                if (!note) return;
                const name = `${note.slice(0, 40) || "Note"}.txt`;
                void upload(new File([note], name, { type: "text/plain" }), "text");
              }}
            >
              Add note
            </button>
          </div>
        ) : mode === "library" ? (
          <div className="flex flex-col gap-2">
            <input
              value={libraryName}
              onChange={(event) => setLibraryName(event.target.value)}
              placeholder="Library item name"
              className={cn(fieldClass, "px-3")}
            />
            <button
              type="button"
              disabled={!libraryName.trim() || busy}
              className={cn(appBtn.primarySm, "self-end disabled:opacity-40")}
              onClick={() => {
                const name = libraryName.trim();
                if (!name) return;
                void upload(
                  new File([`Library item: ${name}`], `${name}.txt`, { type: "text/plain" }),
                  "library",
                );
              }}
            >
              Add from library
            </button>
          </div>
        ) : (
          <label
            className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ui-border)] text-[14px] text-[var(--ui-fg-muted)]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void upload(file, "file");
            }}
          >
            <Paperclip className="mb-2 size-5" strokeWidth={1.75} />
            Drag sources here
            <input
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file, "file");
              }}
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SourceAction icon={<Upload className="size-4" />} label="Upload" onClick={() => setMode("drop")} />
          <SourceAction icon={<Folder className="size-4" />} label="Add from library" onClick={() => setMode("library")} />
          <SourceAction icon={<FileText className="size-4" />} label="Text input" onClick={() => setMode("text")} />
          <SourceAction icon={<Link2 className="size-4" />} label="Google Drive" onClick={() => {
            void upload(new File(["Google Drive"], "Google Drive.txt", { type: "text/plain" }), "drive");
          }} />
          <SourceAction icon={<Link2 className="size-4" />} label="Slack" onClick={() => {
            void upload(new File(["Slack"], "Slack.txt", { type: "text/plain" }), "slack");
          }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-[var(--ui-hover-wash)] text-[12px] text-[var(--ui-fg)] hover:bg-[var(--ui-border-subtle)]"
    >
      {icon}
      {label}
    </button>
  );
}

function RenameChatDialog({
  chat,
  onClose,
  onSave,
}: {
  chat: ProjectChat | null;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  useEffect(() => {
    setTitle(chat?.title ?? "");
  }, [chat]);
  return (
    <Dialog
      open={Boolean(chat)}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (chat) setTitle(chat.title);
      }}
    >
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) onSave(title.trim());
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={cn(fieldClass, "px-3")}
          />
          <button type="submit" className={cn(appBtn.primary, "self-end")}>
            Save
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
