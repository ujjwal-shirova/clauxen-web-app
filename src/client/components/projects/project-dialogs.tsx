"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Lightbulb, Trash } from "@/components/icons/app-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { APP_ROUTES } from "@/lib/app-routes";
import { appBtn } from "@/lib/app-buttons";
import {
  createProject,
  deleteProject,
  updateProject,
  type LibraryAccess,
  type ProjectIcon,
  type ProjectMemory,
  type ProjectSummary,
} from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { DEFAULT_PROJECT_ICON, ProjectIconPicker } from "./project-icon";

const field =
  "w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 text-[14px] text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus:border-[var(--ui-field-focus-border)]";
const inputField = cn(field, "h-10");
const textareaField = cn(field, "resize-none py-2.5 leading-6");
const labelText = "text-[13px] font-medium text-[var(--ui-fg)]";
const helpText = "text-[12.5px] leading-5 text-[var(--ui-fg-muted)]";

function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const active = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          inputField,
          "flex items-center justify-between text-left",
        )}
      >
        {active?.label ?? value}
        <ChevronDown className="text-[15px] text-[var(--ui-fg-muted)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="flex-col items-start gap-0.5"
          >
            <span className="flex w-full items-center gap-2">
              <span className="flex-1">{option.label}</span>
              {option.value === value ? (
                <Check className="text-[15px]" />
              ) : null}
            </span>
            {option.hint ? (
              <span className="text-[12px] text-[var(--ui-fg-muted)]">
                {option.hint}
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MEMORY_OPTIONS: Array<{
  value: ProjectMemory;
  label: string;
  hint: string;
}> = [
  {
    value: "default",
    label: "Shared memory",
    hint: "Reads and writes memory across all your chats.",
  },
  {
    value: "project",
    label: "Project-only memory",
    hint: "Keeps this project's memory isolated from other chats.",
  },
];

const LIBRARY_OPTIONS: Array<{ value: LibraryAccess; label: string; hint: string }> = [
  {
    value: "enabled",
    label: "Enabled",
    hint: "Chats here can read your file library.",
  },
  {
    value: "disabled",
    label: "Disabled",
    hint: "Chats here only see files attached to this project.",
  },
];

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: ProjectSummary) => void;
}) {
  const navigate = useInstantNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<ProjectIcon>(DEFAULT_PROJECT_ICON);
  const [memory, setMemory] = useState<ProjectMemory>("default");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setIcon(DEFAULT_PROJECT_ICON);
    setMemory("default");
    setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[480px] gap-5 p-6">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[19px] font-medium tracking-[-0.03em]">
            Create project
          </DialogTitle>
          <DialogDescription className={helpText}>
            A project keeps related chats, files, instructions and memory
            together.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || busy) return;
            setBusy(true);
            void createProject({
              name: trimmed,
              description: description.trim(),
              iconId: icon.id,
              color: icon.color,
              memory,
            })
              .then((result) => {
                reset();
                onOpenChange(false);
                onCreated?.(result.project);
                navigate(APP_ROUTES.project(result.project.id));
              })
              .catch(() => setBusy(false));
          }}
        >
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className={labelText}>Icon</span>
              <ProjectIconPicker icon={icon} onChange={setIcon} size="lg" />
            </div>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={labelText}>Project name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Copenhagen trip"
                maxLength={120}
                autoFocus
                className={inputField}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelText}>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What this project is for — shown on the project card."
              className={textareaField}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelText}>Memory</span>
            <Select
              ariaLabel="Project memory scope"
              value={memory}
              options={MEMORY_OPTIONS}
              onChange={setMemory}
            />
          </div>

          <div className="flex gap-2.5 rounded-xl bg-[var(--ui-hover-wash)] px-3 py-2.5">
            <Lightbulb className="mt-0.5 shrink-0 text-[16px] text-[var(--ui-fg-muted)]" />
            <p className={helpText}>
              You can add instructions, files and memory notes once the project
              exists.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              className={appBtn.secondary}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className={cn(appBtn.primary, "disabled:opacity-40")}
            >
              {busy ? "Creating…" : "Create project"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (project: ProjectSummary) => void;
  onDeleted?: () => void;
}) {
  const navigate = useInstantNavigate();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [icon, setIcon] = useState(project.icon);
  const [memory, setMemory] = useState(project.memory);
  const [library, setLibrary] = useState(project.libraryAccess);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setDescription(project.description);
    setIcon(project.icon);
    setMemory(project.memory);
    setLibrary(project.libraryAccess);
    setConfirmDelete(false);
  }, [open, project]);

  const dirty =
    name.trim() !== project.name ||
    description !== project.description ||
    icon.id !== project.icon.id ||
    icon.color !== project.icon.color ||
    memory !== project.memory ||
    library !== project.libraryAccess;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] gap-5 p-6">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[19px] font-medium tracking-[-0.03em]">
            Project details
          </DialogTitle>
          <DialogDescription className={helpText}>
            Rename this project, change how it looks, and control what it can
            remember.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed || busy || !dirty) return;
            setBusy(true);
            void updateProject(project.id, {
              name: trimmed,
              description,
              iconId: icon.id,
              color: icon.color,
              memory,
              libraryAccess: library,
            })
              .then((result) => {
                onUpdated(result.project);
                onOpenChange(false);
              })
              .finally(() => setBusy(false));
          }}
        >
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className={labelText}>Icon</span>
              <ProjectIconPicker icon={icon} onChange={setIcon} size="lg" />
            </div>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={labelText}>Project name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                className={inputField}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelText}>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What this project is for."
              className={textareaField}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={labelText}>Memory</span>
            <Select
              ariaLabel="Project memory scope"
              value={memory}
              options={MEMORY_OPTIONS}
              onChange={setMemory}
            />
            <p className={helpText}>
              {MEMORY_OPTIONS.find((option) => option.value === memory)?.hint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelText}>Library access</span>
            <Select
              ariaLabel="Project library access"
              value={library}
              options={LIBRARY_OPTIONS}
              onChange={setLibrary}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--ui-border-subtle)] pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--ui-fg-muted)]">
                  Delete this project?
                </span>
                <button
                  type="button"
                  className="h-8 rounded-full bg-red-600 px-3 text-[13px] font-medium text-white hover:bg-red-700"
                  onClick={() => {
                    void deleteProject(project.id).then(() => {
                      onOpenChange(false);
                      if (onDeleted) onDeleted();
                      else navigate(APP_ROUTES.projects);
                    });
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="h-8 rounded-full px-2 text-[13px] text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-red-600 hover:bg-red-500/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash className="text-[15px]" />
                Delete project
              </button>
            )}
            <button
              type="submit"
              disabled={!name.trim() || !dirty || busy}
              className={cn(appBtn.primary, "disabled:opacity-40")}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
