"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/frontend/components/ui/dialog";

type AddTextContentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string, content: string) => void | Promise<void>;
};

export function AddTextContentModal({
  open,
  onOpenChange,
  onSubmit,
}: AddTextContentModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim() || "Untitled", content);
      setTitle("");
      setContent("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-6 shadow-xl [&>button]:hidden">
        <div className="mb-4 flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Add text content</DialogTitle>
          <button type="button" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your text here…"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="self-end rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {submitting ? "Adding…" : "Add content"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
