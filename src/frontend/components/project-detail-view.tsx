"use client";

import React, { useCallback, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, Plus, Star } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import type { ApiProject } from "@/frontend/lib/api/projects";
import { PromptInput } from "@/frontend/components/prompt-input";
import { SetProjectInstructionsDialog } from "@/frontend/components/set-project-instructions-dialog";
import { ProjectFilesPanel } from "@/frontend/components/project-files-panel";
import { AddTextContentDialog } from "@/frontend/components/add-text-content-dialog";
import { AddGitHubDialog } from "@/frontend/components/add-github-dialog";
import { useAppNotifications } from "@/frontend/hooks/use-app-notifications";
import {
  getProjectInstructions,
  setProjectInstructions,
  getProjectFiles,
  setProjectFiles,
  estimateFileCapacity,
  wouldExceedCapacity,
  type ProjectFileMeta,
} from "@/frontend/lib/project-storage";

type ProjectDetailViewProps = {
  project: ApiProject;
  onBack: () => void;
  onSendMessage: (prompt: string) => void;
  onStopGeneration: () => void;
  isGenerating?: boolean;
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  webSearchEnabled?: boolean;
  onWebSearchEnabledChange?: (enabled: boolean) => void;
};

/** Small icon button matching Claude project page (28×28, subtle hover). */
function ProjectIconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        appBtn.ghost,
        "h-7 w-7 min-w-7 rounded-[7px] p-0 text-zinc-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ProjectDetailView({
  project,
  onBack,
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  thinkingEnabled = false,
  onThinkingEnabledChange,
  webSearchEnabled = false,
  onWebSearchEnabledChange,
}: ProjectDetailViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [instructions, setInstructions] = useState(() =>
    getProjectInstructions(project.id),
  );
  const [files, setFiles] = useState<ProjectFileMeta[]>(() =>
    getProjectFiles(project.id),
  );
  const [starred, setStarred] = useState(false);
  const { notifyInfo, notifyWarning } = useAppNotifications();

  const persistFiles = useCallback(
    (next: ProjectFileMeta[]) => {
      setProjectFiles(project.id, next);
      setFiles(next);
    },
    [project.id],
  );

  const handleSaveInstructions = useCallback(
    (text: string) => {
      setProjectInstructions(project.id, text);
      setInstructions(text);
    },
    [project.id],
  );

  const handleUploadFromDevice = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length) return;
      const existing = getProjectFiles(project.id);
      const incoming: ProjectFileMeta[] = Array.from(list).map((f, i) => {
        const ext = f.name.includes(".")
          ? f.name.split(".").pop()?.toLowerCase()
          : "file";
        return {
          id: `file-${Date.now()}-${i}-${f.name}`,
          name: f.name,
          addedAt: new Date().toISOString(),
          kind: "upload" as const,
          subtitle: ext,
          capacityPercent: estimateFileCapacity({
            id: "",
            name: f.name,
            addedAt: "",
            kind: "upload",
          }),
        };
      });

      const rejected: string[] = [];
      const accepted: ProjectFileMeta[] = [];
      let simulated = [...existing];

      for (const file of incoming) {
        if (wouldExceedCapacity(simulated, [file])) {
          rejected.push(file.name);
        } else {
          accepted.push(file);
          simulated = [...simulated, file];
        }
      }

      if (accepted.length > 0) {
        persistFiles([...existing, ...accepted]);
        notifyInfo(
          accepted.length === 1
            ? `Added ${accepted[0].name}`
            : `Added ${accepted.length} files`,
        );
      }

      for (const name of rejected) {
        notifyWarning(
          `Failed to upload file ${name}. Project knowledge exceeds maximum. Remove files to continue.`,
        );
      }

      e.target.value = "";
    },
    [project.id, persistFiles, notifyInfo, notifyWarning],
  );

  const handleFilesAdded = useCallback(
    (added: ProjectFileMeta[], label?: string) => {
      const existing = getProjectFiles(project.id);
      const rejected: ProjectFileMeta[] = [];
      const accepted: ProjectFileMeta[] = [];
      let simulated = [...existing];

      for (const file of added) {
        if (wouldExceedCapacity(simulated, [file])) {
          rejected.push(file);
        } else {
          accepted.push(file);
          simulated = [...simulated, file];
        }
      }

      if (accepted.length > 0) {
        persistFiles([...existing, ...accepted]);
        notifyInfo(
          label ??
            (accepted.length === 1
              ? `Added ${accepted[0].name}`
              : `Added ${accepted.length} files to project`),
        );
      }

      for (const file of rejected) {
        notifyWarning(
          `Failed to add ${file.name}. Project knowledge exceeds maximum. Remove files to continue.`,
        );
      }
    },
    [project.id, persistFiles, notifyInfo, notifyWarning],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileInputChange}
        aria-hidden
      />

      {/* Sticky top bar — back link */}
      <header className="sticky top-0 z-20 shrink-0 bg-zinc-50">
        <div className="mobile-page-inset relative mx-auto w-full max-w-[1280px] pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4 lg:px-8 lg:pt-6">
          <div className="flex items-center pb-3 sm:pb-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-[14px] font-[430] leading-[19.6px] text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              All projects
            </button>
          </div>
        </div>
      </header>

      {/* 12-column layout: ~7 cols main + ~5 cols sidebar */}
      <main className="mobile-page-inset mx-auto w-full max-w-[1280px] flex-1 overflow-y-auto pb-12 pt-1 sm:pt-2 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-0">
          {/* Left — project title, prompt, empty chats */}
          <div className="flex flex-col gap-5 lg:col-span-7">
            {/* Title row */}
            <div>
              <div className="mb-3 flex items-start gap-3">
                <h1 className="min-w-0 flex-1 font-serif text-[21px] font-medium leading-[1.3] text-zinc-700 sm:text-[24px] sm:leading-[31.2px]">
                  {project.name}
                </h1>
                <div className="ml-auto flex shrink-0 items-center gap-1 pt-0.5">
                  <ProjectIconButton label={`More options for ${project.name}`}>
                    <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
                  </ProjectIconButton>
                  <ProjectIconButton
                    label={starred ? "Unstar project" : "Star project"}
                    onClick={() => setStarred((s) => !s)}
                    className={starred ? "text-amber-600" : undefined}
                  >
                    <Star
                      className={cn("h-5 w-5", starred && "fill-current")}
                      strokeWidth={1.5}
                    />
                  </ProjectIconButton>
                </div>
              </div>
              {project.description ? (
                <p className="text-[14px] font-[430] leading-[19.6px] text-zinc-700">
                  {project.description}
                </p>
              ) : null}
            </div>

            {/* Shared new-chat prompt */}
            <div className="w-full">
              <PromptInput
                onSendMessage={onSendMessage}
                onStopGeneration={onStopGeneration}
                isConversationStarted={false}
                isGenerating={isGenerating}
                thinkingEnabled={thinkingEnabled}
                onThinkingEnabledChange={onThinkingEnabledChange}
                webSearchEnabled={webSearchEnabled}
                onWebSearchEnabledChange={onWebSearchEnabledChange}
                showModelSelector={true}
                focusKey={`project-${project.id}`}
              />
            </div>

            {/* Empty chats placeholder */}
            <div className="rounded-xl border border-zinc-200 px-4 py-6 text-center sm:px-6 sm:py-8 lg:px-8">
              <p className="text-balance text-[14px] font-[430] leading-[19.6px] text-zinc-500">
                Start a chat to keep conversations organized and re-use project
                knowledge.
              </p>
            </div>
          </div>

          {/* Right — instructions & files */}
          <div className="lg:col-span-5 lg:pl-12 lg:pr-4">
            <div className="overflow-hidden rounded-2xl border border-zinc-200">
              {/* Instructions */}
              <section className="px-[22px] pb-4 pt-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex h-6 items-center justify-between gap-4">
                    <h2 className="text-[14px] font-medium leading-[19.6px] text-zinc-700">
                      Instructions
                    </h2>
                    <ProjectIconButton
                      label="Edit instructions"
                      onClick={() => setInstructionsOpen(true)}
                      className="-mr-2"
                    >
                      <Plus className="h-5 w-5" strokeWidth={1.75} />
                    </ProjectIconButton>
                  </div>
                  {instructions ? (
                    <p className="line-clamp-3 text-[12px] font-[430] leading-[16.8px] text-zinc-500">
                      {instructions}
                    </p>
                  ) : (
                    <p className="text-[12px] font-[430] leading-[16.8px] text-zinc-500 opacity-60">
                      Add instructions to tailor Claude&apos;s responses
                    </p>
                  )}
                </div>
              </section>

              <div className="h-px w-full bg-[#1f1f1e]/15" aria-hidden />

              <ProjectFilesPanel
                files={files}
                onUploadFromDevice={handleUploadFromDevice}
                onAddTextContent={() => setTextDialogOpen(true)}
                onGitHub={() => setGithubDialogOpen(true)}
                onFilesChange={persistFiles}
              />
            </div>
          </div>
        </div>
      </main>

      <SetProjectInstructionsDialog
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
        projectName={project.name}
        initialInstructions={instructions}
        onSave={handleSaveInstructions}
      />

      <AddTextContentDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
        projectId={project.id}
        onAdded={(file) => handleFilesAdded([file])}
      />

      <AddGitHubDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        projectId={project.id}
        onAddFiles={(added) => handleFilesAdded(added, "Sync started")}
      />
    </div>
  );
}
