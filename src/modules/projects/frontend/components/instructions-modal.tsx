"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_CHARS = 5000;

type InstructionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  initialInstructions?: string;
  onSave: (instructions: string) => void | Promise<void>;
};

export function InstructionsModal({
  open,
  onOpenChange,
  projectName,
  initialInstructions = "",
  onSave,
}: InstructionsModalProps) {
  const [text, setText] = useState(initialInstructions);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(initialInstructions);
  }, [open, initialInstructions]);

  const canSave = text.trim().length > 0 && text.length <= MAX_CHARS;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(text.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        className="max-w-2xl gap-0 rounded-2xl border-gray-200 bg-white p-0 shadow-xl [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Set project instructions</DialogTitle>
        <DialogDescription className="sr-only">
          Instructions for {projectName}
        </DialogDescription>

        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-black">
                Set project instructions
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Provide Clauxen with relevant instructions and information for
                chats within{" "}
                <span className="font-medium">{projectName}</span>. This will
                work alongside your{" "}
                <span className="text-blue-600 underline">profile instructions</span>{" "}
                and the selected style in a chat.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <textarea
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Think step by step and show reasoning for complex problems. Use specific examples."
              className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <span className="absolute right-2 bottom-2 text-xs text-zinc-400">
              {text.length} / {MAX_CHARS}
            </span>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition-all duration-150 hover:opacity-80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || saving}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save instructions"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
