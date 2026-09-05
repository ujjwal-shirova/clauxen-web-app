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

type SetProjectInstructionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  initialInstructions?: string;
  onSave: (instructions: string) => void;
};

export function SetProjectInstructionsDialog({
  open,
  onOpenChange,
  projectName,
  initialInstructions = "",
  onSave,
}: SetProjectInstructionsDialogProps) {
  const [text, setText] = useState(initialInstructions);

  useEffect(() => {
    if (open) setText(initialInstructions);
  }, [open, initialInstructions]);

  const canSave = text.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave(text.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 border-zinc-200 bg-white p-0 font-sans text-zinc-900",
          "max-w-[720px] rounded-xl shadow-[0_4px_8px_rgba(11,11,11,0.08),0_12px_28px_-2px_rgba(11,11,11,0.08)]",
          "[&>button]:hidden",
        )}
      >
        <DialogTitle className="sr-only">Set project instructions</DialogTitle>
        <DialogDescription className="sr-only">
          Instructions for chats within {projectName}.
        </DialogDescription>

        <div className="flex max-h-[min(721px,90dvh)] flex-col overflow-y-auto p-6">
          <div className="mb-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2
                className="text-[22px] font-semibold leading-[26px] text-zinc-900"
                aria-hidden="true"
              >
                Instructions
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className={cn(
                appBtn.ghostIcon,
                "mr-[-8px] mt-[-8px] shrink-0 text-zinc-500",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <textarea
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Set project instructions"
            className="mb-4 max-h-[320px] min-h-[200px] w-full resize-y rounded-lg border-0 bg-white/80 px-2 py-2 text-[14px] leading-5 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)] outline-none transition focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]"
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={appBtn.secondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={appBtn.primary}
              disabled={!canSave}
              aria-disabled={!canSave}
            >
              Save instructions
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
