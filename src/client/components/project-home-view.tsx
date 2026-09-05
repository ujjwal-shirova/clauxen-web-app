"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiProject } from "@/lib/api/projects";
import { PromptInput } from "@/components/prompt-input";
import { SetProjectInstructionsDialog } from "@/components/set-project-instructions-dialog";
import { ProjectFilesPanel } from "@/components/project-files-panel";
import { AddTextContentDialog } from "@/components/add-text-content-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getProjectFiles,
  getProjectInstructions,
  setProjectFiles,
  setProjectInstructions,
  type ProjectFileMeta,
} from "@/lib/project-storage";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { ProjectIconPicker } from "@/components/project-icon-picker";
import { ProjectChatListRow } from "@/components/projects/project-chat-list-row";
import * as projectFilesApi from "@/lib/api/project-files";
import { useAppNotifications } from "@/hooks/use-app-notifications";
import type { RecentChat } from "@/lib/types";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
} from "@/lib/project-appearance";
import { PROJECT_NAME_MAX_LENGTH } from "@/lib/project-limits";

type ProjectHomeViewProps = {
  project: ApiProject;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  onSendMessage: (prompt: string) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating?: boolean;
  onSaveInstructions?: (text: string) => void | Promise<void>;
  onSaveAppearance?: (next: {
    icon: string;
    color: string;
  }) => void | Promise<void>;
  onSaveName?: (name: string) => void | Promise<void>;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
  projectChats?: RecentChat[];
  onOpenChat?: (chatId: string) => void;
  onNewChat?: () => void;
};

/**
 * Project dashboard — chats, instructions, files, and a composer for a new chat.
 */
export function ProjectHomeView({
  project,
  pinned = false,
  onPinChange,
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  onSaveInstructions,
  onSaveAppearance,
  onSaveName,
  onOpenMobileNav,
  showMobileMenu = false,
  projectChats = [],
  onOpenChat,
  onNewChat,
}: ProjectHomeViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [projectRenameValue, setProjectRenameValue] = useState("");
  const [instructions, setInstructions] = useState(
    () => project.system_prompt ?? getProjectInstructions(project.id),
  );
  const [files, setFiles] = useState<ProjectFileMeta[]>(() =>
    getProjectFiles(project.id),
  );
  const { notifyInfo, notifyWarning } = useAppNotifications();

  useEffect(() => {
    setInstructions(project.system_prompt ?? getProjectInstructions(project.id));
  }, [project.id, project.system_prompt]);

  const refreshFiles = useCallback(async () => {
    const { files: rows } = await projectFilesApi.listProjectFiles(project.id);
    const next = rows.map<ProjectFileMeta>((file) => ({
      id: file.id,
      name: file.original_name,
      addedAt: file.created_at,
      kind: "upload",
      subtitle:
        file.status === "ready"
          ? file.original_name.split(".").pop()?.toLowerCase() || "file"
          : file.status,
      capacityPercent: Math.max(
        1,
        Math.min(25, Math.ceil(Number(file.size_bytes || 0) / 200_000)),
      ),
    }));
    setProjectFiles(project.id, next);
    setFiles(next);
    return next;
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void refreshFiles().catch(() => {
      if (!cancelled) notifyWarning("Project files could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [refreshFiles, notifyWarning]);

  const handleSaveInstructions = useCallback(
    (text: string) => {
      setProjectInstructions(project.id, text);
      setInstructions(text);
      void onSaveInstructions?.(text);
    },
    [project.id, onSaveInstructions],
  );

  const persistFiles = useCallback(
    (next: ProjectFileMeta[]) => {
      const nextIds = new Set(next.map((file) => file.id));
      const removed = files.filter((file) => !nextIds.has(file.id));
      setProjectFiles(project.id, next);
      setFiles(next);
      if (removed.length) {
        void Promise.all(
          removed.map((file) =>
            projectFilesApi.deleteProjectFile(project.id, file.id),
          ),
        ).catch(() => {
          notifyWarning("A project file could not be removed.");
          void refreshFiles();
        });
      }
    },
    [files, notifyWarning, project.id, refreshFiles],
  );

  const handleUpload = useCallback(
    async (list: FileList) => {
      const uploads = Array.from(list);
      if (!uploads.length) return;
      try {
        await Promise.all(
          uploads.map((file) =>
            projectFilesApi.uploadProjectFile(project.id, file),
          ),
        );
        await refreshFiles();
        notifyInfo(
          uploads.length === 1
            ? `${uploads[0]!.name} uploaded`
            : `${uploads.length} files uploaded`,
        );
        window.setTimeout(() => void refreshFiles(), 2_000);
      } catch {
        notifyWarning("One or more project files could not be uploaded.");
      }
    },
    [notifyInfo, notifyWarning, project.id, refreshFiles],
  );

  const focusComposer = () => {
    onNewChat?.();
    composerAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => {
      composerAnchorRef.current
        ?.querySelector<HTMLElement>("textarea, [contenteditable='true']")
        ?.focus();
    }, 80);
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans text-zinc-900">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-100 px-3 sm:px-5">
        {showMobileMenu && onOpenMobileNav ? (
          <MobileMenuButton
            onClick={onOpenMobileNav}
            aria-controls="app-primary-nav"
          />
        ) : null}
        <ProjectIconPicker
          icon={project.icon || DEFAULT_PROJECT_ICON}
          color={project.color || DEFAULT_PROJECT_COLOR}
          size="sm"
          className="shrink-0"
          onChange={(next) => void onSaveAppearance?.(next)}
        />
        <div className="min-w-0 flex-1">
          {isRenamingProject ? (
            <input
              autoFocus
              aria-label="Project name"
              value={projectRenameValue}
              maxLength={PROJECT_NAME_MAX_LENGTH}
              onChange={(event) =>
                setProjectRenameValue(
                  event.target.value.slice(0, PROJECT_NAME_MAX_LENGTH),
                )
              }
              onBlur={() => {
                const next = projectRenameValue
                  .trim()
                  .slice(0, PROJECT_NAME_MAX_LENGTH);
                setIsRenamingProject(false);
                if (next && next !== project.name) {
                  void onSaveName?.(next);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsRenamingProject(false);
                  setProjectRenameValue(project.name);
                }
              }}
              className="h-7 w-full max-w-[min(100%,18rem)] rounded-md border border-zinc-200 bg-white px-1.5 text-[15px] font-semibold tracking-[-0.01em] text-zinc-900 outline-none ring-0"
            />
          ) : (
            <button
              type="button"
              title="Rename project"
              onClick={() => {
                setProjectRenameValue(project.name);
                setIsRenamingProject(true);
              }}
              className="block max-w-full truncate whitespace-nowrap text-left text-[15px] font-semibold tracking-[-0.01em] text-zinc-900 transition-opacity hover:opacity-80"
            >
              {project.name}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={focusComposer}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 text-[13px] font-medium text-white transition hover:bg-zinc-800"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">New chat</span>
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Project options"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[100] w-44">
            <DropdownMenuItem onSelect={() => onPinChange?.(!pinned)}>
              {pinned ? "Unpin project" : "Pin project"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setInstructionsOpen(true)}>
              Edit instructions
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setFilesOpen(true)}>
              Manage files
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 flex-col overflow-y-auto px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
          <div className="flex min-w-0 flex-col">
            {project.description ? (
              <p className="mb-5 max-w-[54ch] text-[14px] leading-5 text-zinc-500">
                {project.description}
              </p>
            ) : null}

            <div ref={composerAnchorRef} className="mb-8">
              <PromptInput
                onSendMessage={onSendMessage}
                onStopGeneration={onStopGeneration}
                isConversationStarted={false}
                isGenerating={isGenerating}
                lockedProjectId={project.id}
                showProjectStrip={false}
                placeholder="New chat"
              />
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-zinc-900">Chats</h2>
              <span className="text-[12px] tabular-nums text-zinc-400">
                {projectChats.length}
              </span>
            </div>
            {projectChats.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white px-3 sm:px-4">
                {projectChats.map((chat) => (
                  <ProjectChatListRow
                    key={chat.id}
                    chat={chat}
                    onOpen={() => onOpenChat?.(chat.id)}
                    onRename={() => onOpenChat?.(chat.id)}
                    onPin={() => undefined}
                    onUnpin={() => undefined}
                    onDelete={() => undefined}
                    showMenu={false}
                  />
                ))}
              </div>
            ) : (
              <div className="min-h-[120px] rounded-2xl border border-dashed border-zinc-200 bg-white/60" />
            )}
          </div>

          <div className="mx-auto flex w-full max-w-[280px] shrink-0 flex-col gap-3 lg:mx-0">
            <button
              type="button"
              onClick={() => setInstructionsOpen(true)}
              className="group flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-4 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/60"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium text-zinc-900">
                  Instructions
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors group-hover:text-zinc-700">
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
              <p className="line-clamp-4 text-[12px] leading-4 text-zinc-500">
                {instructions.trim() || "None"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFilesOpen(true)}
              className="group flex flex-col rounded-2xl border border-zinc-200/90 bg-white p-4 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/60"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium text-zinc-900">
                  Files
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors group-hover:text-zinc-700">
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
              {files.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {files.slice(0, 4).map((file) => (
                    <li
                      key={file.id}
                      className="truncate text-[12px] leading-4 text-zinc-600"
                    >
                      {file.name}
                    </li>
                  ))}
                  {files.length > 4 ? (
                    <li className="text-[12px] text-zinc-400">
                      +{files.length - 4} more
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-[12px] leading-4 text-zinc-500">None</p>
              )}
            </button>
          </div>
        </div>
      </div>

      <SetProjectInstructionsDialog
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
        projectName={project.name}
        initialInstructions={instructions}
        onSave={handleSaveInstructions}
      />

      {filesOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Project files"
          onClick={() => setFilesOpen(false)}
        >
          <div
            className={cn(
              "max-h-[min(80dvh,640px)] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h2 className="text-[15px] font-semibold text-zinc-900">Files</h2>
              <button
                type="button"
                className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
                onClick={() => setFilesOpen(false)}
              >
                Done
              </button>
            </div>
            <div className="max-h-[min(68dvh,560px)] overflow-y-auto p-3">
              <ProjectFilesPanel
                files={files}
                onFilesChange={persistFiles}
                onUploadFromDevice={() => fileInputRef.current?.click()}
                onAddTextContent={() => setTextDialogOpen(true)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <AddTextContentDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
        projectId={project.id}
        onAdded={async (file) => {
          await projectFilesApi.addProjectText(project.id, {
            title: file.name,
            content: file.content ?? "",
          });
          await refreshFiles();
          window.setTimeout(() => void refreshFiles(), 2_000);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          void handleUpload(list);
          e.target.value = "";
        }}
      />
    </div>
  );
}
