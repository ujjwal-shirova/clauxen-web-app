"use client";

import React, { useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";

export type CreateProjectFormValues = {
  name: string;
  description: string;
};

type CreateProjectFormProps = {
  onSubmit: (data: CreateProjectFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  className?: string;
  /** When true, show the “How to use projects” intro card. */
  showIntro?: boolean;
  heading?: string;
  submitLabel?: string;
  initialName?: string;
  initialDescription?: string;
};

/**
 * Inline project create/edit form — centered on `/project`, no dialog chrome.
 */
export function CreateProjectForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
  showIntro = true,
  heading = "Create a project",
  submitLabel = "Create project",
  initialName = "",
  initialDescription = "",
}: CreateProjectFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({ name: name.trim(), description: description.trim() });
  };

  return (
    <div
      className={cn(
        "w-full max-w-[520px] font-sans text-zinc-900",
        className,
      )}
    >
      <h1 className="mb-3 text-[22px] font-semibold leading-[26px] text-zinc-900">
        {heading}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-7 pt-3">
        {showIntro ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[14px] leading-5 text-zinc-600">
            <div className="mb-3 font-medium text-zinc-900">
              How to use projects
            </div>
            <div className="flex flex-col gap-3">
              <p>
                Projects help organize your work and leverage knowledge across
                multiple conversations. Upload docs, code, and files to create
                themed collections that Clauxen can reference again and again.
              </p>
              <p>
                Start by creating a memorable title and description to organize
                your project. You can always edit it later.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="project-name"
            className="text-[14px] font-medium text-zinc-900"
          >
            What are you working on?
          </label>
          <input
            id="project-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your project"
            className="h-8 w-full rounded-lg border-0 bg-white/80 px-2 text-[14px] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="project-description"
            className="text-[14px] font-medium text-zinc-900"
          >
            What are you trying to achieve?
          </label>
          <textarea
            id="project-description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project, goals, subject, etc..."
            className="min-h-[72px] w-full resize-y rounded-lg border-0 bg-white/80 px-2 py-2 text-[14px] leading-5 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className={appBtn.secondary}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            className={appBtn.primary}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            {isSubmitting ? "Creating…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
