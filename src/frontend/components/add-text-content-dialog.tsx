"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import type { ProjectFileMeta } from "@/frontend/lib/project-storage";

type AddTextContentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onAdded?: (file: ProjectFileMeta) => void;
};

export function AddTextContentDialog({
  open,
  onOpenChange,
  projectId,
  onAdded,
}: AddTextContentDialogProps) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    const lineCount = trimmedContent.split(/\r?\n/).length;
    const file: ProjectFileMeta = {
      id: `text-${Date.now()}`,
      name: trimmedTitle.endsWith(".md") ? trimmedTitle : `${trimmedTitle}.md`,
      addedAt: new Date().toISOString(),
      content: trimmedContent,
      kind: "text",
      subtitle: `${lineCount} line${lineCount === 1 ? "" : "s"}`,
    };

    onAdded?.(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-24px)] max-w-[768px] gap-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.08)] [&>button]:hidden",
        )}
      >
        <DialogDescription className="sr-only">
          Add text content to this project.
        </DialogDescription>

        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-zinc-200 px-6 py-5">
          <DialogTitle className="text-[20px] font-semibold leading-[28px] text-zinc-900">
            Add text content
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

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 px-6 pb-6 pt-3"
        >
          <div>
            <label
              htmlFor="text-content-title"
              className="mb-1 block text-[14px] font-[430] text-zinc-700"
            >
              Title <span className="text-[#8d2525]">*</span>
            </label>
            <input
              id="text-content-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your content"
              required
              className="h-11 w-full rounded-[9.6px] border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <label
              htmlFor="text-content-body"
              className="mb-1 block text-[14px] font-[430] text-zinc-700"
            >
              Content <span className="text-[#8d2525]">*</span>
            </label>
            <textarea
              id="text-content-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type or paste in content..."
              required
              rows={12}
              className="min-h-[200px] w-full resize-y rounded-[9.6px] border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={appBtn.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !content.trim()}
              className={appBtn.primary}
            >
              Add Content
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
