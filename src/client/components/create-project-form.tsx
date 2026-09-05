"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { AppHref } from "@/components/app-href";
import { ProjectIconPicker } from "@/components/project-icon-picker";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
} from "@/lib/project-appearance";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
} from "@/lib/project-limits";

export type CreateProjectFormValues = {
  name: string;
  description: string;
  icon: string;
  color: string;
};

type CreateProjectFormProps = {
  onSubmit: (data: CreateProjectFormValues) => void | Promise<void>;
  cancelHref?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  className?: string;
  heading?: string;
  submitLabel?: string;
  initialName?: string;
  initialDescription?: string;
  initialIcon?: string;
  initialColor?: string;
  errorMessage?: string | null;
};

function FieldCounter({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const atLimit = value >= max;
  return (
    <span
      className={cn(
        "pointer-events-none absolute text-[11px] tabular-nums leading-none",
        atLimit ? "text-zinc-500" : "text-zinc-400/90",
        className,
      )}
    >
      {value}/{max}
    </span>
  );
}

export function CreateProjectForm({
  onSubmit,
  cancelHref,
  onCancel,
  isSubmitting = false,
  className,
  heading = "Create a project",
  submitLabel = "Create project",
  initialName = "",
  initialDescription = "",
  initialIcon = DEFAULT_PROJECT_ICON,
  initialColor = DEFAULT_PROJECT_COLOR,
  errorMessage,
}: CreateProjectFormProps) {
  const [name, setName] = useState(
    initialName.slice(0, PROJECT_NAME_MAX_LENGTH),
  );
  const [description, setDescription] = useState(
    initialDescription.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
  );
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);
  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      name: name.trim().slice(0, PROJECT_NAME_MAX_LENGTH),
      description: description.trim().slice(0, PROJECT_DESCRIPTION_MAX_LENGTH),
      icon,
      color,
    });
  };

  return (
    <div className={cn("w-full max-w-[440px] font-sans text-zinc-900", className)}>
      <form onSubmit={handleSubmit} className="flex flex-col items-center">
        <ProjectIconPicker
          icon={icon}
          color={color}
          size="lg"
          disabled={isSubmitting}
          onChange={(next) => {
            setIcon(next.icon);
            setColor(next.color);
          }}
        />

        <h1 className="mt-6 w-full text-center text-[22px] font-semibold tracking-[-0.03em] text-zinc-900">
          {heading}
        </h1>

        <div className="mt-7 flex w-full flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-name"
              className="text-[13px] font-medium text-zinc-800"
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
                className="h-10 w-full rounded-xl border-0 bg-white py-0 pl-3 pr-12 text-[14px] shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.22)]"
                autoFocus
                disabled={isSubmitting}
              />
              <FieldCounter
                value={name.length}
                max={PROJECT_NAME_MAX_LENGTH}
                className="bottom-2 right-2.5"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="project-description"
              className="text-[13px] font-medium text-zinc-800"
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
                className="min-h-[84px] w-full resize-y rounded-xl border-0 bg-white px-3 pb-6 pt-2.5 text-[14px] leading-5 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.22)]"
                disabled={isSubmitting}
              />
              <FieldCounter
                value={description.length}
                max={PROJECT_DESCRIPTION_MAX_LENGTH}
                className="bottom-2 right-2.5"
              />
            </div>
          </div>
        </div>

        <div className="mt-7 flex w-full justify-end gap-2.5">
          {cancelHref ? (
            <AppHref
              href={cancelHref}
              aria-disabled={isSubmitting || undefined}
              className={cn(
                appBtn.secondary,
                isSubmitting && "pointer-events-none opacity-50",
              )}
            >
              Cancel
            </AppHref>
          ) : onCancel ? (
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
        {errorMessage ? (
          <p role="alert" className="mt-3 w-full text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}
