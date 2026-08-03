"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description: string }) => void | Promise<void>;
  isSubmitting?: boolean;
};

export function CreateProjectModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
    } else {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const nameValid = name.trim().length >= 1 && name.trim().length <= 100;
  const descValid = description.length <= 500;
  const canSubmit = nameValid && descValid && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({ name: name.trim(), description: description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        className="max-w-lg gap-0 rounded-2xl border-gray-200 bg-white p-0 shadow-xl [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Create a project</DialogTitle>
        <DialogDescription className="sr-only">
          Name your project and add a description.
        </DialogDescription>

        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-xl font-semibold text-black">Create a project</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-zinc-500 transition-all duration-150 hover:opacity-80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">
              <p className="mb-2 font-medium text-zinc-900">How to use projects</p>
              <p>
                Projects help organize your work and leverage knowledge across
                multiple conversations. Upload docs, code, and files to create
                themed collections that Clauxen can reference again and again.
                Start by creating a memorable title and description to organize
                your project. You can always edit it later.
              </p>
            </div>

            <div>
              <label
                htmlFor="project-name"
                className="mb-1.5 block text-sm font-medium text-black"
              >
                What are you working on?
              </label>
              <input
                ref={nameRef}
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your project"
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="project-desc"
                className="mb-1.5 block text-sm font-medium text-black"
              >
                What are you trying to achieve?
              </label>
              <textarea
                id="project-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project, goals, subject, etc..."
                maxLength={500}
                className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition-all duration-150 hover:opacity-80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-80 disabled:opacity-40"
              >
                {isSubmitting ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
