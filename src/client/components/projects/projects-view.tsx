"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Bot,
  Briefcase,
  CalendarClock,
  Camera,
  Code2,
  FileText,
  FlaskConical,
  FolderKanban,
  Globe,
  Hammer,
  ImagePlus,
  Languages,
  Library,
  Lightbulb,
  Music,
  Paperclip,
  PenLine,
  Puzzle,
  Sparkles,
  Telescope,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppHref } from "@/components/app-href";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { IsolatedChatInput } from "@/components/isolated-chat-input";
import { useAppLayout } from "@/components/app-layout-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { APP_ROUTES } from "@/lib/app-routes";
import { appBtn } from "@/lib/app-buttons";
import {
  createProjectId,
  getProjectDraft,
  listProjectDrafts,
  saveProjectDraft,
  type ProjectDraft,
  type ProjectFile,
  type ProjectIcon,
} from "@/lib/project-drafts";
import { cn } from "@/lib/utils";

const PRESET_ICONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "folder", label: "Folder", icon: FolderKanban },
  { id: "spark", label: "Spark", icon: Sparkles },
  { id: "code", label: "Code", icon: Code2 },
  { id: "research", label: "Research", icon: Telescope },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "library", label: "Library", icon: Library },
  { id: "plugin", label: "Plugin", icon: Puzzle },
  { id: "build", label: "Build", icon: Hammer },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "language", label: "Language", icon: Languages },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "write", label: "Write", icon: PenLine },
  { id: "web", label: "Web", icon: Globe },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "lab", label: "Lab", icon: FlaskConical },
  { id: "audio", label: "Audio", icon: Music },
  { id: "camera", label: "Camera", icon: Camera },
];

const presetById = new Map(PRESET_ICONS.map((item) => [item.id, item]));

function ProjectMark({
  icon,
  className,
  iconClassName,
}: {
  icon: ProjectIcon;
  className?: string;
  iconClassName?: string;
}) {
  if (icon.kind === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon.dataUrl}
        alt=""
        className={cn("object-cover", className)}
      />
    );
  }
  const preset = presetById.get(icon.id) ?? PRESET_ICONS[0];
  const Icon = preset.icon;
  return <Icon className={iconClassName} strokeWidth={1.75} aria-hidden />;
}

async function photoDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function IconPicker({
  icon,
  onChange,
}: {
  icon: ProjectIcon;
  onChange: (icon: ProjectIcon) => void;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose project icon"
          className="group relative flex size-24 items-center justify-center overflow-hidden rounded-[28px] border border-[var(--ui-border)] bg-[var(--ui-field-bg)] text-[var(--ui-fg)] shadow-[0_1px_2px_rgba(20,21,26,0.04)] transition-colors hover:bg-[var(--ui-hover-wash)]"
        >
          <ProjectMark
            icon={icon}
            className="size-full"
            iconClassName="size-9"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={10}
        className="w-[320px] rounded-2xl border-[var(--ui-border)] bg-[var(--ui-field-bg)] p-3 text-[var(--ui-fg)] shadow-lg"
      >
        <p className="px-1 pb-2 text-[12px] font-medium text-[var(--ui-fg-muted)]">
          Icons
        </p>
        <div className="grid grid-cols-6 gap-1">
          {PRESET_ICONS.map((preset) => {
            const selected = icon.kind === "preset" && icon.id === preset.id;
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() => {
                  onChange({ kind: "preset", id: preset.id });
                  setOpen(false);
                }}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]",
                  selected && "bg-[var(--ui-hover-wash)]",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-[var(--ui-border-subtle)] pt-2">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-[13px] text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]"
          >
            <ImagePlus className="size-4 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
            Upload a photo
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void photoDataUrl(file).then((dataUrl) => {
                onChange({ kind: "photo", dataUrl });
                setOpen(false);
              });
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[var(--ui-fg)]">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2.5 text-[14px] text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]";

export function ProjectsView() {
  const pathname = useAppPathname();
  const projectId = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  if (projectId) return <ProjectHome projectId={projectId} />;
  return <CreateProjectPage />;
}

function CreateProjectPage() {
  const navigate = useInstantNavigate();
  const { isMobile, openMobileNav } = useAppLayout();
  const [icon, setIcon] = useState<ProjectIcon>({ kind: "preset", id: "folder" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projects, setProjects] = useState<ProjectDraft[]>([]);

  useEffect(() => {
    setProjects(listProjectDrafts());
  }, []);

  const canCreate = name.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader
          title="Projects"
          onOpenMobileNav={openMobileNav}
          borderless
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[460px] flex-col px-6 pb-16 pt-10 sm:pt-16">
          <div className="flex flex-col items-center text-center">
            <IconPicker icon={icon} onChange={setIcon} />
            <h1 className="mt-5 text-[22px] font-medium tracking-[-0.03em] text-[var(--ui-fg)]">
              New project
            </h1>
            <p className="mt-1 max-w-[34ch] text-[14px] leading-relaxed text-[var(--ui-fg-muted)]">
              Give it a name, a short description, and an icon. You can change these later.
            </p>
          </div>

          <form
            className="mt-8 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              const project: ProjectDraft = {
                id: createProjectId(),
                name: trimmed,
                description: description.trim(),
                icon,
                instructions: "",
                files: [],
                createdAt: new Date().toISOString(),
              };
              saveProjectDraft(project);
              navigate(APP_ROUTES.project(project.id));
            }}
          >
            <Field label="Project name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Launch notes"
                autoFocus
                className={fieldClass}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this project is for"
                rows={3}
                className={cn(fieldClass, "resize-none")}
              />
            </Field>
            <button
              type="submit"
              disabled={!canCreate}
              className={cn(appBtn.primaryLg, "mt-1 disabled:opacity-40")}
            >
              Create project
            </button>
          </form>

          {projects.length ? (
            <div className="mt-10">
              <p className="px-1 text-[12px] font-medium text-[var(--ui-fg-muted)]">
                Your projects
              </p>
              <ul className="mt-2 flex flex-col">
                {projects.map((project) => (
                  <li key={project.id}>
                    <AppHref
                      href={APP_ROUTES.project(project.id)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--ui-hover-wash)]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] text-[var(--ui-fg)]">
                        <ProjectMark
                          icon={project.icon}
                          className="size-full"
                          iconClassName="size-4"
                        />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-[14px] font-medium text-[var(--ui-fg)]">
                          {project.name}
                        </span>
                        {project.description ? (
                          <span className="block truncate text-[13px] text-[var(--ui-fg-muted)]">
                            {project.description}
                          </span>
                        ) : null}
                      </span>
                    </AppHref>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProjectHome({ projectId }: { projectId: string }) {
  const { isMobile, openMobileNav } = useAppLayout();
  const [project, setProject] = useState<ProjectDraft | null | undefined>(
    undefined,
  );
  const [panel, setPanel] = useState<"instructions" | "files" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProject(getProjectDraft(projectId));
    setPanel(null);
  }, [projectId]);

  const persist = (next: ProjectDraft) => {
    setProject(next);
    saveProjectDraft(next);
  };

  if (project === undefined) return null;

  if (!project) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-[20px] font-medium tracking-[-0.03em] text-[var(--ui-fg)]">
          Project not found
        </h1>
        <p className="mt-2 text-[14px] text-[var(--ui-fg-muted)]">
          This project is not on this device yet.
        </p>
        <AppHref href={APP_ROUTES.projects} className={cn(appBtn.secondary, "mt-5")}>
          New project
        </AppHref>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader
          title={project.name}
          subtitle={project.description || undefined}
          onOpenMobileNav={openMobileNav}
          borderless
          leading={
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--ui-border-subtle)]">
              <ProjectMark
                icon={project.icon}
                className="size-full"
                iconClassName="size-4"
              />
            </span>
          }
        />
      ) : (
        <header className="flex shrink-0 items-start gap-3 px-6 pb-2 pt-6 sm:px-8">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] text-[var(--ui-fg)]">
            <ProjectMark
              icon={project.icon}
              className="size-full"
              iconClassName="size-5"
            />
          </span>
          <div className="min-w-0 pt-0.5">
            <h1 className="truncate text-[20px] font-medium tracking-[-0.03em] text-[var(--ui-fg)]">
              {project.name}
            </h1>
            {project.description ? (
              <p className="mt-0.5 line-clamp-2 max-w-xl text-[14px] leading-relaxed text-[var(--ui-fg-muted)]">
                {project.description}
              </p>
            ) : (
              <p className="mt-0.5 text-[14px] text-[var(--ui-fg-subtle)]">
                No description
              </p>
            )}
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col items-center">
          {panel ? (
            <ProjectPanel
              project={project}
              panel={panel}
              onClose={() => setPanel(null)}
              onChange={persist}
              onPickFiles={() => fileInputRef.current?.click()}
            />
          ) : null}

          <div className="w-full" data-prompt-root>
            <IsolatedChatInput
              placeholder={`Message ${project.name}`}
              isConversationStarted={false}
              isGenerating={false}
              focusKey={project.id}
              onStopGeneration={() => {}}
              onSendMessage={() => {}}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <PanelButton
              active={panel === "instructions"}
              label={project.instructions.trim() ? "Instructions" : "Add instructions"}
              icon={<FileText className="size-4" strokeWidth={1.75} />}
              onClick={() =>
                setPanel((current) =>
                  current === "instructions" ? null : "instructions",
                )
              }
            />
            <PanelButton
              active={panel === "files"}
              label={
                project.files.length
                  ? `${project.files.length} file${project.files.length === 1 ? "" : "s"}`
                  : "Add files"
              }
              icon={<Paperclip className="size-4" strokeWidth={1.75} />}
              onClick={() =>
                setPanel((current) => (current === "files" ? null : "files"))
              }
            />
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          const list = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (!list.length) return;
          const added: ProjectFile[] = list.map((file) => ({
            id: createProjectId(),
            name: file.name,
            size: file.size,
            type: file.type || "file",
          }));
          persist({ ...project, files: [...project.files, ...added] });
          setPanel("files");
        }}
      />
    </div>
  );
}

function PanelButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
        active
          ? "border-[var(--ui-border)] bg-[var(--ui-hover-wash)] text-[var(--ui-fg)]"
          : "border-[var(--ui-border-subtle)] bg-transparent text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ProjectPanel({
  project,
  panel,
  onClose,
  onChange,
  onPickFiles,
}: {
  project: ProjectDraft;
  panel: "instructions" | "files";
  onClose: () => void;
  onChange: (project: ProjectDraft) => void;
  onPickFiles: () => void;
}) {
  return (
    <section className="mb-4 w-full rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] p-3 shadow-[0_1px_2px_rgba(20,21,26,0.04)]">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[13px] font-medium text-[var(--ui-fg)]">
          {panel === "instructions" ? "Instructions" : "Project files"}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      {panel === "instructions" ? (
        <textarea
          value={project.instructions}
          onChange={(event) =>
            onChange({ ...project, instructions: event.target.value })
          }
          placeholder="Tell Clauxen how to work in this project. Tone, sources, and what to always include."
          rows={5}
          className="mt-2 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-border)]"
        />
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={onPickFiles}
            className={cn(appBtn.secondarySm, "mb-2")}
          >
            Upload files
          </button>
          {project.files.length ? (
            <ul className="flex flex-col">
              {project.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[var(--ui-hover-wash)]"
                >
                  <FileText className="size-4 shrink-0 text-[var(--ui-fg-muted)]" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ui-fg)]">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--ui-fg-subtle)]">
                    {formatSize(file.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      onChange({
                        ...project,
                        files: project.files.filter((row) => row.id !== file.id),
                      })
                    }
                    className="flex size-7 items-center justify-center rounded-lg text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
                  >
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-2 text-[13px] text-[var(--ui-fg-muted)]">
              Files you add stay with this project and can be used in chats here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
