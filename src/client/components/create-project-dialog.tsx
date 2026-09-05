"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from "@/lib/project-limits";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
  }) => void | Promise<void>;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  initialName?: string;
  initialDescription?: string;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  mode = "create",
  initialName = "",
  initialDescription = "",
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(
      (mode === "edit" ? initialName : "").slice(0, PROJECT_NAME_MAX_LENGTH),
    );
    setDescription(
      (mode === "edit" ? initialDescription : "").slice(
        0,
        PROJECT_DESCRIPTION_MAX_LENGTH,
      ),
    );
  }, [open, mode, initialName, initialDescription]);

  const isEdit = mode === "edit";
  const heading = isEdit ? "Edit project" : "Create a project";
  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      name: name.trim().slice(0, PROJECT_NAME_MAX_LENGTH),
      description: description.trim().slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 border-zinc-200 bg-white p-0 font-sans text-zinc-900",
          "max-w-[520px] rounded-2xl shadow-xl",
          "[&>button]:hidden",
        )}
      >
        <DialogTitle className="sr-only">{heading}</DialogTitle>
        <DialogDescription className="sr-only">{heading}</DialogDescription>

        <div className="flex max-h-[min(721px,90dvh)] flex-col overflow-y-auto p-6">
          <div className="mb-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2
                className="text-[22px] font-semibold leading-[26px] text-zinc-900"
                aria-hidden="true"
              >
                {heading}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className={cn(
                appBtn.ghostIcon,
                "mr-[-8px] mt-[-8px] text-zinc-500",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-7 pt-3">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-name"
                className="text-[14px] font-medium text-zinc-900"
              >
                Project name
              </label>
              <div className="relative">
                <input
                  id="project-name"
                  name="name"
                  value={name}
                  maxLength={PROJECT_NAME_MAX_LENGTH}
                  onChange={(e) =>
                    setName(e.target.value.slice(0, PROJECT_NAME_MAX_LENGTH))
                  }
                  placeholder="Name your project"
                  className="h-8 w-full rounded-lg border-0 bg-white/80 py-0 pl-2 pr-12 text-[14px] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
                  autoFocus
                />
                <span
                  className={cn(
                    "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] tabular-nums leading-none",
                    name.length >= PROJECT_NAME_MAX_LENGTH
                      ? "text-zinc-500"
                      : "text-zinc-400/90",
                  )}
                >
                  {name.length}/{PROJECT_NAME_MAX_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-description"
                className="text-[14px] font-medium text-zinc-900"
              >
                Description
              </label>
              <div className="relative">
                <textarea
                  id="project-description"
                  name="description"
                  rows={3}
                  value={description}
                  maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                  onChange={(e) =>
                    setDescription(
                      e.target.value.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
                    )
                  }
                  placeholder="What this project is for"
                  className="min-h-[72px] w-full resize-y rounded-lg border-0 bg-white/80 px-2 pb-6 pt-2 text-[14px] leading-5 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
                />
                <span
                  className={cn(
                    "pointer-events-none absolute bottom-2 right-2.5 text-[11px] tabular-nums leading-none",
                    description.length >= PROJECT_DESCRIPTION_MAX_LENGTH
                      ? "text-zinc-500"
                      : "text-zinc-400/90",
                  )}
                >
                  {description.length}/{PROJECT_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={appBtn.secondary}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={appBtn.primary}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving…"
                    : "Creating…"
                  : isEdit
                    ? "Save changes"
                    : "Create project"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
