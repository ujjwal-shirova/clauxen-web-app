"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  MoreVertical,
  Plus,
  Star,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import type { ApiProject } from "@/frontend/lib/api/projects";
import type { RecentChat } from "@/frontend/lib/types";
import { PromptInput } from "@/frontend/components/prompt-input";
import { ProjectChatListRow } from "@/frontend/components/projects/project-chat-list-row";
import { DeleteChatDialog } from "@/frontend/components/delete-chat-dialog";
import { RenameChatDialog } from "@/frontend/components/rename-chat-dialog";
import { ProjectsMobileHeader } from "@/frontend/components/projects/projects-mobile-header";
import { ProjectsMobileSegmented } from "@/frontend/components/projects/projects-mobile-segmented";
import { useProjectsShell } from "@/frontend/components/projects/projects-shell-context";
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

type ProjectDetailViewMobileProps = {
  project: ApiProject;
  onBack: () => void;
  onSendMessage: (prompt: string) => void | Promise<void>;
  onStopGeneration: () => void;
  isGenerating?: boolean;
  thinkingEnabled?: boolean;
  onThinkingEnabledChange?: (enabled: boolean) => void;
  webSearchEnabled?: boolean;
  onWebSearchEnabledChange?: (enabled: boolean) => void;
  chatModel?: import("@/lib/chat-models").ChatModelId;
  onChatModelChange?: (model: import("@/lib/chat-models").ChatModelId) => void;
  projectChats?: RecentChat[];
  onOpenChat?: (chatId: string) => void;
  onOpenMobileNav?: () => void;
  onRenameChat?: (chatId: string, newName: string) => void | Promise<void>;
  onDeleteChat?: (chatId: string) => void | Promise<void>;
  onPinChat?: (chatId: string, pinned: boolean) => void | Promise<void>;
  activeChatId?: string | null;
};

type MobileTab = "chat" | "knowledge";

export function ProjectDetailViewMobile({
  project,
  onBack,
  onSendMessage,
  onStopGeneration,
  isGenerating = false,
  thinkingEnabled = false,
  onThinkingEnabledChange,
  webSearchEnabled = false,
  onWebSearchEnabledChange,
  chatModel = "helios",
  onChatModelChange,
  projectChats = [],
  onOpenChat,
  onOpenMobileNav,
  onRenameChat,
  onDeleteChat,
  onPinChat,
  activeChatId = null,
}: ProjectDetailViewMobileProps) {
  const shell = useProjectsShell();
  const openNav = onOpenMobileNav ?? shell.openMobileNav;
  const isNavOpen = onOpenMobileNav ? false : !shell.isSidebarCollapsed;
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>("chat");
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
          `Failed to upload file ${name}. Project knowledge exceeds maximum.`,
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
              : `Added ${accepted.length} files`),
        );
      }

      for (const file of rejected) {
        notifyWarning(`Failed to add ${file.name}. Project knowledge exceeds maximum.`);
      }
    },
    [project.id, persistFiles, notifyInfo, notifyWarning],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-shell-bg)] lg:hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileInputChange}
        aria-hidden
      />

      <ProjectsMobileHeader
        title={project.name}
        onOpenMobileNav={openNav}
        isNavOpen={onOpenMobileNav ? false : isNavOpen}
        trailing={
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={starred ? "Unstar project" : "Star project"}
              onClick={() => setStarred((s) => !s)}
              className={cn(
                appBtn.ghost,
                "h-8 w-8 rounded-lg p-0",
                starred && "text-amber-600",
              )}
            >
              <Star
                className={cn("h-4 w-4", starred && "fill-current")}
                strokeWidth={1.75}
              />
            </button>
            <button
              type="button"
              aria-label="Project options"
              className={cn(appBtn.ghost, "h-8 w-8 rounded-lg p-0")}
            >
              <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      <button
        type="button"
        onClick={onBack}
        className="flex shrink-0 items-center gap-1.5 border-b border-zinc-100 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-600 active:bg-zinc-50 sm:px-4"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        All projects
      </button>

      {project.description ? (
        <p className="shrink-0 border-b border-zinc-100 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-zinc-600 sm:px-4">
          {project.description}
        </p>
      ) : null}

      <ProjectsMobileSegmented
        segments={[
          { id: "chat", label: "Chat", badge: projectChats.length },
          {
            id: "knowledge",
            label: "Knowledge",
            badge: files.length + (instructions.trim() ? 1 : 0),
          },
        ]}
        value={activeTab}
        onChange={(id) => setActiveTab(id as MobileTab)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "chat" ? (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-2 sm:px-4">
              <section className="mb-4">
                <h2 className="mb-2 px-0.5 text-[12px] font-medium uppercase tracking-wide text-zinc-500">
                  New chat
                </h2>
                <div className="rounded-2xl border border-zinc-200 bg-white p-1 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
                  <PromptInput
                    onSendMessage={onSendMessage}
                    onStopGeneration={onStopGeneration}
                    isConversationStarted={false}
                    isGenerating={isGenerating}
                    thinkingEnabled={thinkingEnabled}
                    onThinkingEnabledChange={onThinkingEnabledChange}
                    webSearchEnabled={webSearchEnabled}
                    onWebSearchEnabledChange={onWebSearchEnabledChange}
                    chatModel={chatModel}
                    onChatModelChange={onChatModelChange}
                    showModelSelector={true}
                    focusKey={`project-mobile-${project.id}`}
                  />
                </div>
              </section>

              <section>
                <h2 className="mb-2 px-0.5 text-[12px] font-medium uppercase tracking-wide text-zinc-500">
                  Conversations
                </h2>
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
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center">
                    <p className="text-[13px] leading-relaxed text-zinc-500">
                      Send a message above to start your first project chat.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
              <section className="px-4 pb-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[14px] font-medium text-zinc-800">
                      Instructions
                    </h2>
                    {instructions ? (
                      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                        {instructions}
                      </p>
                    ) : (
                      <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                        Add instructions to tailor responses for this project.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Edit instructions"
                    onClick={() => setInstructionsOpen(true)}
                    className={cn(
                      appBtn.ghost,
                      "h-8 w-8 shrink-0 rounded-lg p-0",
                    )}
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </section>

              <div className="h-px bg-zinc-100" aria-hidden />

              <ProjectFilesPanel
                files={files}
                onUploadFromDevice={handleUploadFromDevice}
                onAddTextContent={() => setTextDialogOpen(true)}
                onGitHub={() => setGithubDialogOpen(true)}
                onFilesChange={persistFiles}
              />
            </div>
          </div>
        )}
      </div>

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
  );
}
