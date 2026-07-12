"use client";

import { useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { HintTooltip } from "@/frontend/components/ui/hint-tooltip";
import type { QueuedChatMessage } from "@/frontend/stores/chat-store";

type MessageQueuePanelProps = {
  items: QueuedChatMessage[];
  onEdit: (id: string, content: string) => void;
  onSendNow: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * Claude-style queue strip above the prompt composer.
 * Collapsed = header only; expanded = per-item edit / send / delete.
 */
export function MessageQueuePanel({
  items,
  onEdit,
  onSendNow,
  onRemove,
}: MessageQueuePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (items.length === 0) return null;

  const countLabel = `${items.length} Queued`;

  const startEdit = (item: QueuedChatMessage) => {
    setEditingId(item.id);
    setDraft(item.content);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const next = draft.trim();
    if (next) onEdit(editingId, next);
    setEditingId(null);
    setDraft("");
  };

  return (
    <div
      className="mb-2 w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
      data-message-queue
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-none">
          <span className="font-medium text-zinc-800">{countLabel}</span>
          <CornerDownLeft
            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-zinc-400">to Send</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="no-hover inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          aria-expanded={expanded}
        >
          Start Multitasking
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          )}
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2"
              >
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit();
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setDraft("");
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-800 outline-none"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-800">
                    {item.content}
                  </p>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  <HintTooltip content="Edit">
                    <button
                      type="button"
                      aria-label="Edit queued message"
                      onClick={() => startEdit(item)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Send now">
                    <button
                      type="button"
                      aria-label="Send queued message now"
                      onClick={() => onSendNow(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Remove">
                    <button
                      type="button"
                      aria-label="Remove queued message"
                      onClick={() => onRemove(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </HintTooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
