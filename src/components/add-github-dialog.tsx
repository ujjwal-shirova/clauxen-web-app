"use client";

import * as React from "react";
import { useState } from "react";
import { X, ChevronDown, Link2, Search } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import type { ProjectFileMeta } from "@/lib/project-storage";

const MOCK_REPO = "ujjwal-tyagi-india/awesome-nano-banana-pro-prompts";

const MOCK_FILES = [
  { name: ".github", size: "2%" },
  { name: "docs", size: "<1%" },
  { name: "public", size: "298%" },
  { name: "scripts", size: "11%" },
  { name: ".env.example", size: "<1%" },
  { name: ".gitignore", size: "<1%" },
  { name: "LICENSE", size: "<1%" },
  { name: "README.md", size: "23%" },
];

type AddGitHubDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onAddFiles?: (files: ProjectFileMeta[]) => void;
};

export function AddGitHubDialog({
  open,
  onOpenChange,
  projectId,
  onAddFiles,
}: AddGitHubDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    const stamp = Date.now();
    const newFiles: ProjectFileMeta[] = [...selected].map((path, i) => {
      const isRepoRoot =
        !path.includes(".") && !path.includes("/") && path === MOCK_REPO;
      const displayName = isRepoRoot ? MOCK_REPO : path;
      const lineHint =
        path === "README.md"
          ? "193 lines"
          : path.endsWith(".md")
            ? "md"
            : "main";
      return {
        id: `gh-${stamp}-${i}-${path.replace(/\//g, "-")}`,
        name: displayName,
        addedAt: new Date().toISOString(),
        kind: "github" as const,
        githubRepo: MOCK_REPO,
        subtitle: isRepoRoot ? "main" : lineHint,
        capacityPercent: path === "README.md" ? 8 : 12,
      };
    });
    onAddFiles?.(newFiles);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[calc(100vw-24px)] max-w-[768px] flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-0 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.08)] [&>button]:hidden",
          "max-h-[min(721px,calc(100vh-2rem))]",
        )}
      >
        <DialogDescription className="sr-only">
          Select GitHub files to add to this project.
        </DialogDescription>

        <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-zinc-200 px-6 py-5">
          <DialogTitle className="text-[20px] font-semibold leading-[28px] text-zinc-900">
            Add content from GitHub
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(appBtn.ghostIcon, "text-zinc-500")}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="shrink-0 px-6 pb-2 text-[14px] leading-5 text-zinc-700">
            Select the files you would like to add to this project
          </p>

          <div className="mx-6 mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <GithubIcon className="h-[18px] w-[18px] text-zinc-900" />
            <button
              type="button"
              className="flex min-w-0 max-w-[280px] items-center gap-1 truncate rounded-md border border-zinc-200 px-2 py-1 text-left text-[14px] font-[430] text-zinc-700 hover:bg-black/[0.02]"
            >
              <span className="truncate">{MOCK_REPO}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
            <button
              type="button"
              className={cn(appBtn.ghostIcon, "h-8 w-8 text-zinc-700")}
              aria-label="Paste GitHub URL"
            >
              <Link2 className="h-4 w-4" />
            </button>
            <div className="relative min-w-[120px] flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#898781]" />
              <input
                type="search"
                placeholder="Search files"
                className="h-8 w-full rounded-md bg-transparent py-1 pl-8 pr-2 text-[14px] text-zinc-900 placeholder:text-[#898781] outline-none"
              />
            </div>
          </div>

          <div className="mx-6 mb-4 flex min-h-[280px] max-h-[min(400px,calc(100vh-18rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_0px_rgba(0,0,0,0.05)]">
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50/50 px-4 py-2">
              <label className="flex flex-1 cursor-pointer items-center gap-3 text-[14px] font-[430] text-zinc-700">
                <input
                  type="checkbox"
                  checked={
                    MOCK_FILES.length > 0 && selected.size === MOCK_FILES.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(MOCK_FILES.map((f) => f.name)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                  className="h-4 w-4 rounded border border-zinc-200 accent-zinc-900"
                />
                Select directory
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {MOCK_FILES.map((file) => {
                const checked = selected.has(file.name);
                return (
                  <label
                    key={file.name}
                    className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 px-4 py-2 hover:bg-black/[0.02] last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(file.name)}
                      className="h-4 w-4 shrink-0 rounded border border-zinc-200 accent-zinc-900"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-700">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[12px] text-zinc-500">
                      {file.size}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={appBtn.secondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selected.size === 0}
            className={appBtn.primary}
          >
            Add ({selected.size}) file{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
