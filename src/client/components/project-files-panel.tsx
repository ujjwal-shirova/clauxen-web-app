"use client";

import * as React from "react";
import { Plus, Trash2, X, Info, ExternalLink, FileStack } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { ProjectFilesMenu } from "@/components/project-files-menu";
import {
  PROJECT_CAPACITY_MAX,
  getProjectCapacityUsed,
  type ProjectFileMeta,
} from "@/lib/project-storage";

function fileExtensionLabel(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "file";
  return parts.pop()!.toLowerCase();
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 12 12"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M2 6.5L4.5 9L10.5 3"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ProjectFilesPanelProps = {
  files: ProjectFileMeta[];
  onUploadFromDevice: () => void;
  onAddTextContent: () => void;
  onGitHub: () => void;
  onFilesChange: (files: ProjectFileMeta[]) => void;
};

export function ProjectFilesPanel({
  files,
  onUploadFromDevice,
  onAddTextContent,
  onGitHub,
  onFilesChange,
}: ProjectFilesPanelProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const capacityUsed = getProjectCapacityUsed(files);
  const capacityLabel = `${capacityUsed}% of project capacity used`;

  const selectionMode = selectedIds.size > 0;
  const allSelected = files.length > 0 && selectedIds.size === files.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = () => {
    const remaining = files.filter((f) => !selectedIds.has(f.id));
    onFilesChange(remaining);
    setSelectedIds(new Set());
  };

  return (
    <section className="flex flex-col gap-2 px-5 py-4">
      <div className="flex h-7 items-center justify-between gap-4">
        <h2 className="text-[14px] font-medium text-zinc-800">Files</h2>
        <ProjectFilesMenu
          onUploadFromDevice={onUploadFromDevice}
          onAddTextContent={onAddTextContent}
          onGitHub={onGitHub}
        >
          <button
            type="button"
            aria-label="Add files"
            className={cn(
              appBtn.ghost,
              "relative -mr-2 h-7 w-7 min-w-7 rounded-[7px] p-0 text-zinc-900",
            )}
          >
            <Plus className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </ProjectFilesMenu>
      </div>

      {/* Capacity bar */}
      <div className="mb-1">
        <div
          role="progressbar"
          aria-valuenow={capacityUsed}
          aria-valuemin={0}
          aria-valuemax={PROJECT_CAPACITY_MAX}
          aria-label="Project knowledge capacity"
          className="relative rounded-full border border-zinc-200 bg-zinc-100 p-px"
        >
          <div
            className="h-1.5 rounded-full bg-zinc-800 transition-[width] duration-150 ease-out"
            style={{
              width: `${Math.max(capacityUsed, files.length > 0 ? 2 : 0)}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] leading-4">
          <span className="flex-1 text-zinc-500">{capacityLabel}</span>
          <a
            href="https://support.anthropic.com/en/articles/9517075-what-are-projects"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about project knowledge"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-black/[0.04]"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="flex h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center">
          <FileStack
            className="h-9 w-9 text-zinc-300"
            strokeWidth={1.15}
            aria-hidden
          />
          <p className="max-w-[232px] text-[12px] leading-relaxed text-zinc-500">
            Add PDFs, documents, or other text to reference in this project.
          </p>
        </div>
      ) : (
        <>
          {/* Selection toolbar */}
          {selectionMode ? (
            <div className="ml-1 flex items-center gap-2.5">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                    allSelected
                      ? "border-[#256bc1] bg-[#256bc1]"
                      : "border-[rgba(31,31,30,0.25)] bg-white",
                  )}
                >
                  {allSelected ? <CheckIcon className="text-white" /> : null}
                </span>
                <span className="sr-only">Select all ({files.length})</span>
              </label>
              <span className="text-[14px] font-[430] tabular-nums text-zinc-500">
                <span>{selectedIds.size}</span> selected
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Delete ${selectedIds.size} selected items`}
                  onClick={deleteSelected}
                  className={cn(
                    appBtn.ghost,
                    "h-9 w-9 rounded-md p-0 text-zinc-700",
                  )}
                >
                  <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Cancel selection"
                  onClick={clearSelection}
                  className={cn(
                    appBtn.ghost,
                    "h-9 w-9 rounded-md p-0 text-zinc-700",
                  )}
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ) : null}

          {/* File grid */}
          <ul
            className="mt-1 grid list-none grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 p-0"
            style={{ marginLeft: 4, marginRight: -10 }}
          >
            {files.map((file) => {
              const selected = selectedIds.has(file.id);
              const isGithub = file.kind === "github";
              const badge = isGithub ? "GITHUB" : fileExtensionLabel(file.name);
              const subtitle =
                file.subtitle ??
                (isGithub ? "main" : file.content ? "text" : undefined);

              return (
                <li key={file.id} className="relative min-w-0">
                  <button
                    type="button"
                    aria-label={`${file.name}${subtitle ? `, ${subtitle}` : ""}`}
                    onClick={() => toggleSelect(file.id)}
                    className={cn(
                      "flex h-[120px] w-full min-w-0 flex-col justify-between rounded-lg border-[0.5px] border-[rgba(31,31,30,0.25)] bg-white px-2.5 py-2 text-left shadow-[0_1px_2px_0px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_2px_4px_0px_rgba(0,0,0,0.06)]",
                      selected && "ring-2 ring-[#256bc1]/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="line-clamp-3 text-[12px] leading-[18px] text-zinc-900">
                        {file.name}
                      </h3>
                      {subtitle ? (
                        <p className="truncate text-[10px] leading-[15px] text-zinc-500">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1">
                        {isGithub ? (
                          <span className="inline-flex h-[18px] max-w-full items-center gap-0.5 rounded border-[0.5px] border-[rgba(31,31,30,0.25)] bg-white/70 px-1 backdrop-blur-sm">
                            <GithubIcon className="h-3 w-3" />
                            <span className="truncate text-[11px] font-medium uppercase leading-[13px] text-zinc-700">
                              {badge}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex h-[18px] items-center rounded border-[0.5px] border-[rgba(31,31,30,0.25)] bg-white/70 px-1 text-[11px] font-medium uppercase leading-[13px] text-zinc-700 backdrop-blur-sm">
                            {badge}
                          </span>
                        )}
                      </div>
                      <label
                        className="flex shrink-0 cursor-pointer items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(file.id)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "flex h-[18px] w-[18px] items-center justify-center rounded border-[0.5px] shadow-[0_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors",
                            selected
                              ? "border-[#256bc1] bg-[#256bc1]"
                              : "border-[rgba(31,31,30,0.25)] bg-white/70 backdrop-blur-sm",
                          )}
                        >
                          {selected ? (
                            <CheckIcon className="text-white" />
                          ) : null}
                        </span>
                        <span className="sr-only">Select: {file.name}</span>
                      </label>
                    </div>
                  </button>
                  {!selectionMode && file.githubRepo ? (
                    <a
                      href={`https://github.com/${file.githubRepo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded border-[0.5px] border-[rgba(31,31,30,0.25)] bg-white/70 text-zinc-900 backdrop-blur-sm hover:bg-white"
                      aria-label="Open on GitHub"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
