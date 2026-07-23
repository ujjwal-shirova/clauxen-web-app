"use client";

import React, { useCallback, useRef, useState } from "react";
import { Folder, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { PromptInput } from "@/frontend/components/prompt-input";
import { SetProjectInstructionsDialog } from "@/frontend/components/set-project-instructions-dialog";
import { ProjectFilesPanel } from "@/frontend/components/project-files-panel";
import { AddTextContentDialog } from "@/frontend/components/add-text-content-dialog";
import { AddGitHubDialog } from "@/frontend/components/add-github-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import {
  getProjectFiles,
  getProjectInstructions,
  setProjectFiles,
  setProjectInstructions,
  type ProjectFileMeta,
} from "@/frontend/lib/project-storage";
import { MobileMenuButton } from "@/frontend/components/mobile-menu-button";

type ProjectHomeViewProps = {
  project: ApiProject;
  pinned?: boolean;
  onPinChange?: (pinned: boolean) => void;
  onSendMessage: (prompt: string) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating?: boolean;
  onSaveInstructions?: (text: string) => void | Promise<void>;
  onOpenMobileNav?: () => void;
  showMobileMenu?: boolean;
};

function SharedContextIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="28"
        y="22"
        width="72"
        height="48"
        rx="16"
        fill="#f4f4f5"
        stroke="#e4e4e7"
      />
      <rect x="40" y="36" width="36" height="6" rx="3" fill="#d4d4d8" />
      <rect x="40" y="48" width="48" height="6" rx="3" fill="#e4e4e7" />
      <rect
        x="60"
        y="50"
        width="72"
        height="48"
        rx="16"
        fill="#fafafa"
        stroke="#e4e4e7"
      />
      <rect x="72" y="64" width="40" height="6" rx="3" fill="#d4d4d8" />
      <rect x="72" y="76" width="28" height="6" rx="3" fill="#e4e4e7" />
    </svg>
  );
}

function InstructionsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="24" y="16" width="56" height="48" rx="8" fill="#f4f4f5" stroke="#e4e4e7" />
      <rect x="34" y="28" width="36" height="4" rx="2" fill="#d4d4d8" />
      <rect x="34" y="38" width="28" height="4" rx="2" fill="#e4e4e7" />
      <rect x="34" y="48" width="32" height="4" rx="2" fill="#e4e4e7" />
      <path
        d="M78 52l12-12 6 6-12 12-7 1 1-7z"
        fill="#fafafa"
        stroke="#a1a1aa"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function FilesIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="30" y="20" width="36" height="44" rx="6" fill="#f4f4f5" stroke="#e4e4e7" />
      <rect x="48" y="28" width="36" height="44" rx="6" fill="#fafafa" stroke="#d4d4d8" />
      <rect x="56" y="40" width="20" height="3" rx="1.5" fill="#d4d4d8" />
      <rect x="56" y="48" width="16" height="3" rx="1.5" fill="#e4e4e7" />
      <rect x="56" y="56" width="18" height="3" rx="1.5" fill="#e4e4e7" />
    </svg>
  );
}

/**
 * Project dashboard — shared context + instructions/files + composer.
 * Sending a prompt starts a project-scoped chat (wired by the route).
 */
export function ProjectHomeView({
  project,
  pinned = false,
  onPinChange,
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  onSaveInstructions,
  onOpenMobileNav,
  showMobileMenu = false,
}: ProjectHomeViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [instructions, setInstructions] = useState(
    () => project.system_prompt ?? getProjectInstructions(project.id),
  );
  const [files, setFiles] = useState<ProjectFileMeta[]>(() =>
    getProjectFiles(project.id),
  );

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
      setProjectFiles(project.id, next);
      setFiles(next);
    },
    [project.id],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white font-sans text-zinc-900">
      <header className="flex h-11 shrink-0 items-center gap-2 px-3 sm:px-5">
        {showMobileMenu && onOpenMobileNav ? (
          <MobileMenuButton
            onClick={onOpenMobileNav}
            aria-controls="app-primary-nav"
          />
        ) : null}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          <Folder className="h-4 w-4" strokeWidth={1.75} />
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2f6fed]"
            aria-hidden
          />
        </div>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-zinc-900">
          {project.name}
        </h1>
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
            <DropdownMenuItem
              onSelect={() => onPinChange?.(!pinned)}
            >
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

      <div className="mx-auto flex min-h-0 w-full max-w-[960px] flex-1 flex-col overflow-y-auto px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 py-6 text-center lg:py-10">
            <SharedContextIllustration className="mb-5 h-[110px] w-[148px]" />
            <p className="max-w-[34ch] text-[13.5px] leading-5 text-zinc-500">
              Shared context across all chats in this project. Help Clauxen
              understand you better over time.
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-[300px] shrink-0 flex-col gap-3 lg:mx-0">
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
              <InstructionsIllustration className="mx-auto mb-3 h-16 w-24" />
              <p className="text-[12px] leading-4 text-zinc-500">
                {instructions.trim()
                  ? "Custom instructions are active for chats in this project."
                  : "Add instructions so Clauxen can answer according to your preferences."}
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
              <FilesIllustration className="mx-auto mb-3 h-16 w-24" />
              <p className="text-[12px] leading-4 text-zinc-500">
                {files.length > 0
                  ? `${files.length} file${files.length === 1 ? "" : "s"} available across project chats.`
                  : "Added files are referenced and managed by Clauxen across all project chats, and may be modified or removed in the process."}
              </p>
            </button>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 px-3 pb-4 pt-1 sm:px-5"
        data-composer-dock
      >
        <div className="mx-auto w-full max-w-[768px]">
          <PromptInput
            onSendMessage={onSendMessage}
            onStopGeneration={onStopGeneration}
            isConversationStarted={false}
            isGenerating={isGenerating}
            lockedProjectId={project.id}
            showProjectStrip={false}
            placeholder={`Start chatting in '${project.name}'...`}
          />
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
                onGitHub={() => setGithubDialogOpen(true)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <AddTextContentDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
        projectId={project.id}
        onAdded={(file) =>
          persistFiles([...getProjectFiles(project.id), file])
        }
      />
      <AddGitHubDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        projectId={project.id}
        onAddFiles={(added) =>
          persistFiles([...getProjectFiles(project.id), ...added])
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          const existing = getProjectFiles(project.id);
          const incoming: ProjectFileMeta[] = Array.from(list).map((f, i) => ({
            id: `file-${Date.now()}-${i}-${f.name}`,
            name: f.name,
            addedAt: new Date().toISOString(),
            kind: "upload" as const,
            subtitle: f.name.includes(".")
              ? f.name.split(".").pop()?.toLowerCase()
              : "file",
          }));
          persistFiles([...existing, ...incoming]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
