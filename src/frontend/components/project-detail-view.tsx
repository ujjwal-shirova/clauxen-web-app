"use client";

import React, { useCallback, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, Plus, Star } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import type { ApiProject } from "@/frontend/lib/api/projects";
import type { RecentChat } from "@/frontend/lib/types";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";
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
import { ProjectDetailViewMobile } from "@/frontend/components/projects/project-detail-view-mobile";
import { ProjectChatListRow } from "@/frontend/components/projects/project-chat-list-row";
import { DeleteChatDialog } from "@/frontend/components/delete-chat-dialog";
import { RenameChatDialog } from "@/frontend/components/rename-chat-dialog";
import { useIsMobile } from "@/frontend/hooks/use-mobile";

type ProjectDetailViewProps = {
  project: ApiProject;
  onBack: () => void;
  onSendMessage: (prompt: string) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating?: boolean;
  homerReasoningEffort?: import("@/lib/model-effort").HomerReasoningEffort;
  onHomerReasoningEffortChange?: (
    effort: import("@/lib/model-effort").HomerReasoningEffort,
  ) => void;
  chatModel?: import("@/lib/chat-models").ChatModelId;
  onChatModelChange?: (model: import("@/lib/chat-models").ChatModelId) => void;
  projectChats?: RecentChat[];
  onOpenChat?: (chatId: string) => void;
  onNewChat?: () => void;
  onSaveInstructions?: (text: string) => void | Promise<void>;
  onOpenMobileNav?: () => void;
  onRenameChat?: (chatId: string, newName: string) => void | Promise<void>;
  onDeleteChat?: (chatId: string) => void | Promise<void>;
  onPinChat?: (chatId: string, pinned: boolean) => void | Promise<void>;
  activeChatId?: string | null;
};

/** Small icon button for project toolbar actions. */
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
  homerReasoningEffort = "high",
  onHomerReasoningEffortChange,
  chatModel = DEFAULT_CHAT_MODEL_ID,
  onChatModelChange,
  projectChats = [],
  onOpenChat,
  onNewChat,
  onSaveInstructions,
  onOpenMobileNav,
  onRenameChat,
  onDeleteChat,
  onPinChat,
  activeChatId = null,
}: ProjectDetailViewProps) {
  const isMobile = useIsMobile();
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [instructions, setInstructions] = useState(
    () => project.system_prompt ?? getProjectInstructions(project.id),
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
      // localStorage stays as the immediate cache + fallback for local projects.
      setProjectInstructions(project.id, text);
      setInstructions(text);
      // Server-backed projects also persist to projects.system_prompt.
      void onSaveInstructions?.(text);
    },
    [project.id, onSaveInstructions],
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
    <>
      {isMobile ? (
        <ProjectDetailViewMobile
          project={project}
          onBack={onBack}
          onSendMessage={onSendMessage}
          onStopGeneration={onStopGeneration}
          isGenerating={isGenerating}
          homerReasoningEffort={homerReasoningEffort}
          onHomerReasoningEffortChange={onHomerReasoningEffortChange}
          chatModel={chatModel}
          onChatModelChange={onChatModelChange}
          projectChats={projectChats}
          onOpenChat={onOpenChat}
          onNewChat={onNewChat}
          onSaveInstructions={onSaveInstructions}
          onOpenMobileNav={onOpenMobileNav}
          onRenameChat={onRenameChat}
          onDeleteChat={onDeleteChat}
          onPinChat={onPinChat}
          activeChatId={activeChatId}
        />
      ) : null}

      <div
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white font-sans text-zinc-900",
          isMobile && "hidden",
        )}
      >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileInputChange}
        aria-hidden
      />

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col overflow-y-auto px-6 pb-16 pt-8 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 -ml-2 text-[14px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          All projects
        </button>

        <div className="mb-6 flex items-start gap-4">
          <h1 className="min-w-0 flex-1 font-serif text-[32px] font-normal leading-[1.2] tracking-[-0.02em] text-zinc-900">
            {project.name}
          </h1>
          <div className="flex shrink-0 items-center gap-1 pt-1">
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
            <button
              type="button"
              className="ml-1 inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              Share
            </button>
          </div>
        </div>

        {project.description ? (
          <p className="mb-6 max-w-[52ch] text-[14px] leading-relaxed text-zinc-600">
            {project.description}
          </p>
        ) : null}

        <div className="mb-8 w-full">
          <PromptInput
            onSendMessage={onSendMessage}
            onStopGeneration={onStopGeneration}
            isConversationStarted={false}
            isGenerating={isGenerating}
            homerReasoningEffort={homerReasoningEffort}
            onHomerReasoningEffortChange={onHomerReasoningEffortChange}
            chatModel={chatModel}
            onChatModelChange={onChatModelChange}
            focusKey={`project-${project.id}`}
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-medium text-zinc-800">Conversations</h2>
          <button
            type="button"
            onClick={() => onNewChat?.()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New chat
          </button>
        </div>

        {projectChats.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {projectChats.map((chat) => (
              <ProjectChatListRow
                key={chat.id}
                chat={chat}
                active={activeChatId === chat.id}
                onOpen={() => onOpenChat?.(chat.id)}
                onRename={() => setRenameChatId(chat.id)}
                onPin={() => void onPinChat?.(chat.id, true)}
                onUnpin={() => void onPinChat?.(chat.id, false)}
                onDelete={() => setDeleteChatId(chat.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-10 text-center">
            <p className="text-[14px] leading-relaxed text-zinc-500">
              Start a chat above to keep conversations organized and reuse
              project knowledge.
            </p>
          </div>
        )}

        <section className="mt-10 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
          <div className="px-5 pb-4 pt-5">
            <div className="flex flex-col gap-1.5">
              <div className="flex h-7 items-center justify-between gap-4">
                <h2 className="text-[14px] font-medium text-zinc-800">
                  Instructions
                </h2>
                <ProjectIconButton
                  label="Edit instructions"
                  onClick={() => setInstructionsOpen(true)}
                  className="-mr-1"
                >
                  <Plus className="h-5 w-5" strokeWidth={1.75} />
                </ProjectIconButton>
              </div>
              {instructions ? (
                <p className="line-clamp-4 text-[13px] leading-relaxed text-zinc-600">
                  {instructions}
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-zinc-400">
                  Add instructions to tailor responses for this project.
                </p>
              )}
            </div>
          </div>
          <div className="h-px w-full bg-zinc-100" aria-hidden />
          <ProjectFilesPanel
            files={files}
            onUploadFromDevice={handleUploadFromDevice}
            onAddTextContent={() => setTextDialogOpen(true)}
            onGitHub={() => setGithubDialogOpen(true)}
            onFilesChange={persistFiles}
          />
        </section>
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

      <RenameChatDialog
        open={renameChatId != null}
        onOpenChange={(open) => {
          if (!open) setRenameChatId(null);
        }}
        chatTitle={
          projectChats.find((c) => c.id === renameChatId)?.name ?? "New Chat"
        }
        onConfirm={(title) => {
          if (renameChatId) void onRenameChat?.(renameChatId, title);
          setRenameChatId(null);
        }}
      />

      <DeleteChatDialog
        open={deleteChatId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteChatId(null);
        }}
        chatTitle={
          projectChats.find((c) => c.id === deleteChatId)?.name ?? "New Chat"
        }
        onConfirm={() => {
          if (deleteChatId) void onDeleteChat?.(deleteChatId);
          setDeleteChatId(null);
        }}
      />
      </div>
    </>
  );
}
