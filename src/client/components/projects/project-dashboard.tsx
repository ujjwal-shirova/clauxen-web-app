"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Share,
  SquarePen,
  Trash,
  Upload,
  X,
} from "@/components/icons/app-icons";
import { AppHref } from "@/components/app-href";
import { IsolatedChatInput } from "@/components/isolated-chat-input";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { useProjectDocumentTitle } from "@/hooks/use-document-title";
import { useToast } from "@/hooks/use-toast";
import { useChatSession } from "@/contexts/chat-session-context";
import { APP_ROUTES } from "@/lib/app-routes";
import { appBtn } from "@/lib/app-buttons";
import * as chatsApi from "@/lib/api/chats";
import { deleteUserFile, uploadUserFile } from "@/lib/api/files";
import {
  createProjectNote,
  deleteProjectNote,
  getProject,
  updateProject,
  updateProjectNote,
  type ProjectChat,
  type ProjectDetail,
  type ProjectNote,
  type ProjectSource,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { ProjectMark } from "./project-icon";
import { ProjectDetailsDialog } from "./project-dialogs";
import { copyText, formatBytes, relativeDate } from "./project-format";

type DashboardTab = "chats" | "files" | "instructions" | "memory";

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "chats", label: "Chats" },
  { id: "files", label: "Files" },
  { id: "instructions", label: "Instructions" },
  { id: "memory", label: "Memory" },
];

const panelClass =
  "rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)]";

function EmptyPanel({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--ui-hover-wash)] text-[20px] text-[var(--ui-fg-muted)]">
        {icon}
      </span>
      <p className="mt-3.5 text-[15px] font-medium text-[var(--ui-fg)]">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-6 text-[var(--ui-fg-muted)]">
        {body}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ChatsPanel({
  chats,
  onChanged,
  onOpen,
}: {
  chats: ProjectChat[];
  onChanged: () => void;
  onOpen: (chatId: string) => void;
}) {
  const { toast } = useToast();
  const ordered = useMemo(
    () =>
      [...chats].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (a.updatedAt < b.updatedAt ? 1 : -1),
      ),
    [chats],
  );

  if (!ordered.length) {
    return (
      <div className={panelClass}>
        <EmptyPanel
          icon={<MessageSquare />}
          title="No chats yet"
          body="Start one with the composer above. Every chat you begin here stays in this project."
        />
      </div>
    );
  }

  return (
    <ul className={cn(panelClass, "divide-y divide-[var(--ui-border-subtle)]")}>
      {ordered.map((chat) => (
        <li
          key={chat.id}
          className="group flex items-center gap-3 px-3 py-3 first:rounded-t-2xl last:rounded-b-2xl hover:bg-[var(--ui-hover-wash)]"
        >
          <button
            type="button"
            onClick={() => onOpen(chat.id)}
            className="no-hover-overlay min-w-0 flex-1 bg-transparent text-left"
          >
            <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[var(--ui-fg)]">
              <span className="truncate">{chat.title}</span>
              {chat.pinned ? (
                <Pin className="shrink-0 text-[12px] text-[var(--ui-fg-subtle)]" />
              ) : null}
            </p>
            {chat.preview ? (
              <p className="truncate text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
                {chat.preview}
              </p>
            ) : null}
          </button>
          <span className="shrink-0 text-[12px] text-[var(--ui-fg-subtle)]">
            {relativeDate(chat.updatedAt)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${chat.title}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[17px] text-[var(--ui-fg-muted)] outline-none hover:bg-[var(--ui-field-bg)] hover:text-[var(--ui-fg)] data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  void copyText(
                    `${window.location.origin}${APP_ROUTES.chat(chat.id)}`,
                  ).then((ok) =>
                    toast({
                      title: ok ? "Link copied" : "Could not copy link",
                    }),
                  );
                }}
              >
                <Share className="text-[15px]" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void (
                    chat.pinned
                      ? chatsApi.unpinChat(chat.id)
                      : chatsApi.pinChat(chat.id)
                  ).then(onChanged);
                }}
              >
                {chat.pinned ? (
                  <PinOff className="text-[15px]" />
                ) : (
                  <Pin className="text-[15px]" />
                )}
                {chat.pinned ? "Unpin chat" : "Pin chat"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void chatsApi.archiveChat(chat.id).then(onChanged);
                }}
              >
                <Archive className="text-[15px]" />
                Archive chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={() => {
                  void chatsApi.deleteChat(chat.id).then(onChanged);
                }}
              >
                <Trash className="text-[15px]" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}

function FilesPanel({
  projectId,
  sources,
  onChanged,
}: {
  projectId: string;
  sources: ProjectSource[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading((count) => count + files.length);
    try {
      await Promise.all(
        files.map((file) =>
          uploadUserFile(file, {
            purpose: "project-source",
            projectId,
            sourceKind: "file",
          }),
        ),
      );
      onChanged();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(0);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files ?? []));
        }}
        className={cn(
          "flex flex-col items-center rounded-2xl border border-dashed px-6 py-8 text-center transition",
          dragging
            ? "border-[var(--ui-field-focus-border)] bg-[var(--ui-hover-wash)]"
            : "border-[var(--ui-border)]",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--ui-hover-wash)] text-[20px] text-[var(--ui-fg-muted)]">
          <Upload />
        </span>
        <p className="mt-3.5 text-[14px] font-medium text-[var(--ui-fg)]">
          {uploading ? `Uploading ${uploading} file…` : "Add project context"}
        </p>
        <p className="mt-1 max-w-sm text-[13px] leading-6 text-[var(--ui-fg-muted)]">
          Drop files here, or browse. Every chat in this project can read them.
        </p>
        <button
          type="button"
          className={cn(appBtn.secondarySm, "mt-3.5")}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void upload(files);
          }}
        />
      </div>

      {sources.length ? (
        <ul
          className={cn(panelClass, "divide-y divide-[var(--ui-border-subtle)]")}
        >
          {sources.map((source) => (
            <li
              key={source.id}
              className="group flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--ui-hover-wash)]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ui-hover-wash)] text-[17px] text-[var(--ui-fg-muted)]">
                <FileText />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-[var(--ui-fg)]">
                  {source.name}
                </p>
                <p className="text-[12px] text-[var(--ui-fg-subtle)]">
                  {formatBytes(source.size)} · {relativeDate(source.createdAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${source.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[15px] text-[var(--ui-fg-muted)] hover:bg-[var(--ui-field-bg)] hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                onClick={() => {
                  void deleteUserFile(source.id).then(onChanged);
                }}
              >
                <X />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function InstructionsPanel({
  project,
  onSaved,
}: {
  project: ProjectDetail;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(project.instructions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(project.instructions);
    setSaved(false);
  }, [project.id, project.instructions]);

  const dirty = value !== project.instructions;

  return (
    <div className={cn(panelClass, "flex flex-col gap-3 p-4")}>
      <div>
        <h3 className="text-[14px] font-medium text-[var(--ui-fg)]">
          Custom instructions
        </h3>
        <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
          Prepended to every chat in this project — tone, format, standing
          context, anything you would otherwise retype.
        </p>
      </div>
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
        rows={10}
        maxLength={8000}
        placeholder={
          'e.g. "Answer in British English. Assume the reader knows TypeScript. Always show the failing test before the fix."'
        }
        className="w-full resize-y rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2.5 text-[14px] leading-6 text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-[var(--ui-fg-subtle)]">
          {value.length.toLocaleString()} / 8,000
        </span>
        <div className="flex items-center gap-2">
          {saved && !dirty ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--ui-fg-muted)]">
              <Check className="text-[14px]" />
              Saved
            </span>
          ) : null}
          {dirty ? (
            <button
              type="button"
              className={appBtn.secondarySm}
              onClick={() => setValue(project.instructions)}
            >
              Discard
            </button>
          ) : null}
          <button
            type="button"
            disabled={!dirty || saving}
            className={cn(appBtn.primarySm, "disabled:opacity-40")}
            onClick={() => {
              setSaving(true);
              void updateProject(project.id, { instructions: value })
                .then(() => {
                  setSaved(true);
                  onSaved();
                })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save instructions"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryPanel({
  project,
  onChanged,
}: {
  project: ProjectDetail;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const add = () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    void createProjectNote(project.id, body)
      .then(() => {
        setDraft("");
        onChanged();
      })
      .finally(() => setBusy(false));
  };

  const saveEdit = (note: ProjectNote) => {
    const body = editDraft.trim();
    if (!body) return;
    void updateProjectNote(project.id, note.id, { body }).then(() => {
      setEditingId(null);
      onChanged();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(panelClass, "flex flex-col gap-3 p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-medium text-[var(--ui-fg)]">
              Project memory
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
              Durable facts for this project. Every chat here reads them;
              pinned notes come first.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium",
              project.memory === "project"
                ? "bg-[var(--ui-hover-wash)] text-[var(--ui-fg)]"
                : "bg-[var(--ui-hover-wash)] text-[var(--ui-fg-muted)]",
            )}
          >
            {project.memory === "project" ? "Project-only" : "Shared memory"}
          </span>
        </div>

        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                add();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Remember that… (⌘↵ to add)"
            className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2.5 text-[14px] leading-6 text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]"
          />
          <button
            type="button"
            disabled={!draft.trim() || busy}
            className={cn(appBtn.primary, "shrink-0 gap-1.5 self-end disabled:opacity-40")}
            onClick={add}
          >
            <Plus className="text-[16px]" />
            Add
          </button>
        </div>
      </div>

      {project.notes.length ? (
        <ul
          className={cn(panelClass, "divide-y divide-[var(--ui-border-subtle)]")}
        >
          {project.notes.map((note) => (
            <li
              key={note.id}
              className="group flex items-start gap-3 px-3 py-3 hover:bg-[var(--ui-hover-wash)]"
            >
              <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-hover-wash)] text-[13px] text-[var(--ui-fg-muted)]">
                <Lightbulb />
              </span>
              {editingId === note.id ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    autoFocus
                    className="w-full resize-none rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 py-2 text-[13.5px] leading-6 text-[var(--ui-fg)] outline-none focus:border-[var(--ui-field-focus-border)]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={appBtn.primarySm}
                      onClick={() => saveEdit(note)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={appBtn.secondarySm}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-6 text-[var(--ui-fg)]">
                  {note.body}
                </p>
              )}
              {editingId === note.id ? null : (
                <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={note.pinned ? "Unpin note" : "Pin note"}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-[15px] hover:bg-[var(--ui-field-bg)]",
                      note.pinned
                        ? "text-[var(--ui-fg)] md:opacity-100"
                        : "text-[var(--ui-fg-muted)]",
                    )}
                    onClick={() => {
                      void updateProjectNote(project.id, note.id, {
                        pinned: !note.pinned,
                      }).then(onChanged);
                    }}
                  >
                    {note.pinned ? <PinOff /> : <Pin />}
                  </button>
                  <button
                    type="button"
                    aria-label="Edit note"
                    className="flex size-8 items-center justify-center rounded-lg text-[15px] text-[var(--ui-fg-muted)] hover:bg-[var(--ui-field-bg)] hover:text-[var(--ui-fg)]"
                    onClick={() => {
                      setEditingId(note.id);
                      setEditDraft(note.body);
                    }}
                  >
                    <SquarePen />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete note"
                    className="flex size-8 items-center justify-center rounded-lg text-[15px] text-[var(--ui-fg-muted)] hover:bg-[var(--ui-field-bg)] hover:text-red-600"
                    onClick={() => {
                      void deleteProjectNote(project.id, note.id).then(
                        onChanged,
                      );
                    }}
                  >
                    <Trash />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className={panelClass}>
          <EmptyPanel
            icon={<Lightbulb />}
            title="No memory notes"
            body="Add a note above and every chat in this project will know it without being told again."
          />
        </div>
      )}
    </div>
  );
}

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { isMobile, openMobileNav } = useAppLayout();
  const { toast } = useToast();
  const navigate = useInstantNavigate();
  const session = useChatSession();
  const [project, setProject] = useState<ProjectDetail | null | undefined>(
    undefined,
  );
  const [tab, setTab] = useState<DashboardTab>("chats");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useProjectDocumentTitle(project?.name);

  const reload = () => {
    void getProject(projectId)
      .then((result) => setProject(result.project))
      .catch(() => setProject(null));
  };

  useEffect(() => {
    setProject(undefined);
    setTab("chats");
    void getProject(projectId)
      .then((result) => setProject(result.project))
      .catch(() => setProject(null));
  }, [projectId]);

  if (project === undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="mx-auto w-full max-w-[var(--ui-page-max-width)] px-4 pt-8 sm:px-6">
          <div className="h-11 w-48 animate-pulse rounded-xl bg-[var(--ui-hover-wash)]" />
          <div className="mt-6 h-[108px] animate-pulse rounded-2xl bg-[var(--ui-hover-wash)]" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-[var(--ui-hover-wash)]" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-[20px] font-medium text-[var(--ui-fg)]">
            Project not found
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--ui-fg-muted)]">
            It may have been deleted, or the link is wrong.
          </p>
          <AppHref
            href={APP_ROUTES.projects}
            className={cn(appBtn.secondary, "mt-4 inline-flex")}
          >
            Back to projects
          </AppHref>
        </div>
      </div>
    );
  }

  const counts: Record<DashboardTab, number | null> = {
    chats: project.chats.length,
    files: project.sources.length,
    instructions: null,
    memory: project.notes.length,
  };

  const manageMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Manage project"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--ui-border)] text-[17px] text-[var(--ui-fg-muted)] outline-none hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
          <SquarePen className="text-[15px]" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void updateProject(project.id, { pinned: !project.pinned }).then(
              reload,
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
              .then(reload)
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
          onSelect={() => setDetailsOpen(true)}
        >
          <Trash className="text-[15px]" />
          Delete project…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const shareButton = (
    <button
      type="button"
      className={cn(appBtn.secondarySm, "gap-1.5 rounded-full")}
      onClick={() => {
        void copyText(
          `${window.location.origin}${APP_ROUTES.project(project.id)}`,
        ).then((ok) =>
          toast({ title: ok ? "Link copied" : "Could not copy link" }),
        );
      }}
    >
      <Share className="text-[14px]" />
      Share
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {isMobile ? (
        <MobilePageHeader
          title={project.name}
          onOpenMobileNav={openMobileNav}
          borderless
          trailing={manageMenu}
        />
      ) : (
        <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-[var(--ui-border-subtle)] bg-background/85 px-5 py-2.5 backdrop-blur">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-1 text-[13.5px]"
          >
            <AppHref
              href={APP_ROUTES.projects}
              className="rounded-md px-1.5 py-1 text-[var(--ui-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
            >
              Projects
            </AppHref>
            <ChevronRight
              className="shrink-0 text-[14px] text-[var(--ui-fg-subtle)]"
              aria-hidden
            />
            <span
              aria-current="page"
              className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 font-medium text-[var(--ui-fg)]"
            >
              <span className="truncate">{project.name}</span>
              {project.archived ? (
                <span className="shrink-0 rounded-full bg-[var(--ui-hover-wash)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--ui-fg-muted)]">
                  Archived
                </span>
              ) : null}
            </span>
          </nav>
          {shareButton}
          {manageMenu}
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[var(--ui-page-max-width)] flex-col px-4 pb-20 pt-6 sm:px-6">
          <div className="flex items-start gap-3.5">
            <ProjectMark icon={project.icon} size="xl" />
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="flex items-center gap-2 text-[26px] font-medium leading-tight tracking-[-0.04em] text-[var(--ui-fg)]">
                <span className="min-w-0 break-words">{project.name}</span>
                {project.pinned ? (
                  <Pin
                    className="shrink-0 text-[16px] text-[var(--ui-fg-subtle)]"
                    aria-label="Pinned"
                  />
                ) : null}
              </h1>
              {project.description ? (
                <p className="mt-1.5 text-[14px] leading-6 text-[var(--ui-fg-muted)]">
                  {project.description}
                </p>
              ) : (
                <button
                  type="button"
                  className="mt-1.5 text-[13.5px] text-[var(--ui-fg-subtle)] underline-offset-4 hover:text-[var(--ui-fg-muted)] hover:underline"
                  onClick={() => setDetailsOpen(true)}
                >
                  Add a description
                </button>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12.5px] text-[var(--ui-fg-subtle)]">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="text-[14px]" />
                  {project.chats.length} chats
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="text-[14px]" />
                  {project.sources.length} files
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="text-[14px]" />
                  Updated {relativeDate(project.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 w-full" data-prompt-root>
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

          <div
            role="tablist"
            aria-label="Project sections"
            className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--ui-border-subtle)]"
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-[13.5px] transition",
                  tab === id
                    ? "border-[var(--ui-fg)] font-medium text-[var(--ui-fg)]"
                    : "border-transparent text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]",
                )}
              >
                {label}
                {counts[id] !== null ? (
                  <span className="ml-1.5 text-[12px] text-[var(--ui-fg-subtle)]">
                    {counts[id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "chats" ? (
              <ChatsPanel
                chats={project.chats}
                onChanged={reload}
                onOpen={(chatId) => navigate(APP_ROUTES.chat(chatId))}
              />
            ) : null}
            {tab === "files" ? (
              <FilesPanel
                projectId={project.id}
                sources={project.sources}
                onChanged={reload}
              />
            ) : null}
            {tab === "instructions" ? (
              <InstructionsPanel project={project} onSaved={reload} />
            ) : null}
            {tab === "memory" ? (
              <MemoryPanel project={project} onChanged={reload} />
            ) : null}
          </div>
        </div>
      </div>

      <ProjectDetailsDialog
        project={project}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdated={() => {
          setDetailsOpen(false);
          reload();
        }}
      />
    </div>
  );
}
