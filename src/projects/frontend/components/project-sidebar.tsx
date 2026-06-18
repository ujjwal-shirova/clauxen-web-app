"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  Type,
  Loader2,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { GithubIcon } from "@/frontend/components/icons/github-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import type { ProjectFile } from "@/projects/frontend/api";
import {
  uploadProjectFiles,
  addTextContent,
  deleteProjectFile,
  retryFileIngestion,
} from "@/projects/frontend/api";
import { InstructionsModal } from "@/projects/frontend/components/instructions-modal";
import { AddTextContentModal } from "@/projects/frontend/components/add-text-content-modal";
import { useUpdateInstructions } from "@/projects/frontend/hooks";
import { useQueryClient } from "@tanstack/react-query";

type ProjectSidebarProps = {
  projectId: string;
  projectName: string;
  systemPrompt: string | null;
  files: ProjectFile[];
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectSidebar({
  projectId,
  projectName,
  systemPrompt,
  files,
}: ProjectSidebarProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const updateInstructions = useUpdateInstructions(projectId);

  const refreshFiles = () =>
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    await uploadProjectFiles(projectId, Array.from(fileList));
    await refreshFiles();
  };

  const handleAddText = async (title: string, content: string) => {
    await addTextContent(projectId, title, content);
    await refreshFiles();
  };

  const handleDelete = async (fileId: string) => {
    await deleteProjectFile(projectId, fileId);
    await refreshFiles();
  };

  const handleRetry = async (fileId: string) => {
    await retryFileIngestion(projectId, fileId);
    await refreshFiles();
  };

  return (
    <>
      <aside className="w-full shrink-0 border-gray-200 lg:w-80 lg:border-l lg:pl-6">
        <div className="sticky top-6 rounded-2xl border border-gray-200 bg-[#F5F4EF]">
          <section className="border-b border-gray-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-black">Instructions</h2>
              <button
                type="button"
                aria-label="Edit instructions"
                onClick={() => setInstructionsOpen(true)}
                className="rounded-md p-1 transition-all duration-150 hover:opacity-80"
              >
                {systemPrompt ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
            {systemPrompt ? (
              <p className="line-clamp-2 text-xs text-zinc-500">{systemPrompt}</p>
            ) : (
              <p className="text-xs text-zinc-400">
                Add instructions to tailor Claude&apos;s responses
              </p>
            )}
          </section>

          <section className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-black">Files</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add files"
                    className="rounded-md p-1 transition-all duration-150 hover:opacity-80"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Upload from device
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTextModalOpen(true)}>
                    <Type className="mr-2 h-4 w-4" />
                    Add text content
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <GithubIcon className="mr-2 h-4 w-4" />
                    GitHub (coming soon)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.csv,.html,.md,.epub,.rtf"
              className="sr-only"
              onChange={(e) => void handleUpload(e.target.files)}
            />

            {files.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-xl bg-zinc-100 px-4 text-center">
                <p className="text-xs text-zinc-500">
                  Add PDFs, documents, or other text to reference in this project.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">
                        {file.filename}
                      </p>
                      <p className="text-zinc-400">{formatFileSize(file.fileSize)}</p>
                      {file.status === "processing" ? (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processing…
                        </span>
                      ) : file.status === "failed" ? (
                        <span className="text-red-600">
                          Failed: {file.errorMessage ?? "Error"}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {file.status === "failed" ? (
                        <button
                          type="button"
                          aria-label="Retry"
                          onClick={() => void handleRetry(file.id)}
                          className="rounded p-1 hover:bg-zinc-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label="Delete file"
                        onClick={() => void handleDelete(file.id)}
                        className="rounded p-1 hover:bg-zinc-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>

      <InstructionsModal
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
        projectName={projectName}
        initialInstructions={systemPrompt ?? ""}
        onSave={async (text) => {
          await updateInstructions.mutateAsync(text);
        }}
      />

      <AddTextContentModal
        open={textModalOpen}
        onOpenChange={setTextModalOpen}
        onSubmit={handleAddText}
      />
    </>
  );
}
