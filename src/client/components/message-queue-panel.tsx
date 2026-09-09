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
import { cn } from "@/lib/utils";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import type { QueuedChatMessage } from "@/stores/chat-store";

type MessageQueuePanelProps = {
  items: QueuedChatMessage[];
  onEdit: (id: string, content: string) => void;
  onSendNow: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * Compact queue strip above the prompt composer.
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
      className="mb-1.5 w-full overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)]"
      data-message-queue
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1 text-[12px] leading-none">
          <span className="font-medium text-[var(--ui-fg)]">{countLabel}</span>
          <CornerDownLeft
            className="h-3 w-3 shrink-0 text-[var(--ui-fg-placeholder)]"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-[var(--ui-fg-placeholder)]">to Send</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="no-hover inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:text-[var(--ui-fg)]"
          aria-expanded={expanded}
        >
          Start Multitasking
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-[var(--ui-fg-placeholder)]" aria-hidden />
          ) : (
            <ChevronUp className="h-3 w-3 text-[var(--ui-fg-placeholder)]" aria-hidden />
          )}
        </button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1 px-1.5 pb-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--ui-muted-surface)] px-2 py-1"
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
                    className="min-w-0 flex-1 bg-transparent text-[12px] leading-4 text-[var(--ui-fg)] outline-none"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-[12px] leading-4 text-[var(--ui-fg-muted)]">
                    {item.content}
                  </p>
                )}
                <div className="flex shrink-0 items-center">
                  <HintTooltip content="Edit">
                    <button
                      type="button"
                      aria-label="Edit queued message"
                      onClick={() => startEdit(item)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ui-fg-placeholder)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Send now">
                    <button
                      type="button"
                      aria-label="Send queued message now"
                      onClick={() => onSendNow(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ui-fg-placeholder)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                  </HintTooltip>
                  <HintTooltip content="Remove">
                    <button
                      type="button"
                      aria-label="Remove queued message"
                      onClick={() => onRemove(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--ui-fg-placeholder)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      <Trash2 className="h-3 w-3" />
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
