"use client";

import {
  ArrowUp,
  FileText,
  Globe,
  ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Square,
  Telescope,
  X,
} from "lucide-react";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/frontend/lib/utils";
import type { DemoAttachment } from "./demo-files";

const SINGLE_LINE_PX = 20;

/** Measure natural content height without min/max constraints (same idea as PromptInput). */
function measureScrollHeight(textarea: HTMLTextAreaElement): number {
  const prev = {
    height: textarea.style.height,
    minHeight: textarea.style.minHeight,
    maxHeight: textarea.style.maxHeight,
    overflow: textarea.style.overflow,
  };
  textarea.style.height = "0px";
  textarea.style.minHeight = "0px";
  textarea.style.maxHeight = "none";
  textarea.style.overflow = "hidden";
  const measured = textarea.scrollHeight;
  textarea.style.height = prev.height;
  textarea.style.minHeight = prev.minHeight;
  textarea.style.maxHeight = prev.maxHeight;
  textarea.style.overflow = prev.overflow;
  return measured;
}

/** Demo-only + menu — mirrors PromptAddMenuPanel visuals, no main-app wiring. */
function DemoAddMenu() {
  const items = [
    {
      id: "files",
      label: "Add photos & files",
      description: "Upload from computer",
      icon: Paperclip,
    },
    {
      id: "image",
      label: "Create image",
      description: "Visualize anything",
      icon: ImageIcon,
      iconClassName: "text-violet-500",
    },
    {
      id: "web-search",
      label: "Web search",
      description: "Find real-time news and info",
      icon: Globe,
      iconClassName: "text-sky-500",
    },
    {
      id: "deep-research",
      label: "Deep research",
      description: "Get a detailed report",
      icon: Telescope,
      iconClassName: "text-blue-500",
    },
  ] as const;

  return (
    <motion.div
      data-demo-add-menu
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.985 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="mb-2 w-full overflow-hidden rounded-[14px] border border-zinc-200/90 bg-white font-sans shadow-[0_8px_28px_-20px_rgba(24,24,27,0.28)]"
    >
      <div className="flex flex-col gap-0.5 p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              data-demo-add-item={item.id}
              className="group flex w-full min-h-[34px] items-center gap-2 rounded-[8px] px-2 py-1 text-left"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-zinc-200/80 bg-white">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 text-zinc-700",
                    "iconClassName" in item ? item.iconClassName : undefined,
                  )}
                  strokeWidth={1.75}
                />
              </span>
              <span className="min-w-0 flex-1 leading-none">
                <span className="block truncate text-[13px] font-medium leading-4 text-zinc-900">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] leading-4 text-zinc-500">
                  {item.description}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-zinc-100 px-1.5 py-1">
        <div className="w-full rounded-md px-1.5 py-1.5 text-[11.5px] leading-4 text-zinc-400">
          Type to search plugins, files & skills
        </div>
      </div>
    </motion.div>
  );
}

function AttachmentChip({ file }: { file: DemoAttachment }) {
  const isImage = file.kind === "image";
  return (
    <div
      data-demo-attachment={file.id}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-zinc-200/90 bg-zinc-50",
        isImage ? "h-12 w-12" : "flex h-12 max-w-[140px] items-center gap-1.5 px-1.5 pr-2",
      )}
    >
      {isImage ? (
        <img
          src={file.previewUrl}
          alt={file.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
            <img
              src={file.previewUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium leading-3 text-zinc-800">
              {file.name}
            </p>
            <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-zinc-400">
              <FileText className="h-2.5 w-2.5" />
              {file.kind.toUpperCase()}
            </p>
          </div>
        </>
      )}
      <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white opacity-0">
        <X className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}

/**
 * Login-demo-only composer — visual twin of PromptInput, fully controlled.
 * Stays collapsed until text truly wraps; expands for attachments like ChatGPT.
 */
export const DemoComposer = forwardRef<
  HTMLDivElement,
  {
    value: string;
    isGenerating?: boolean;
    isConversationStarted?: boolean;
    addMenuOpen?: boolean;
    attachments?: DemoAttachment[];
    dropHighlight?: boolean;
    className?: string;
  }
>(function DemoComposer(
  {
    value,
    isGenerating = false,
    isConversationStarted = false,
    addMenuOpen = false,
    attachments = [],
    dropHighlight = false,
    className,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const multilineRef = useRef(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const hasDraft = value.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  // Attachments force stacked layout (ChatGPT-style expand).
  const useCompact = !isMultiline && !hasAttachments;

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    if (!hasDraft && !hasAttachments) {
      multilineRef.current = false;
      if (isMultiline) setIsMultiline(false);
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
      ta.style.overflow = "hidden";
      return;
    }

    if (!multilineRef.current && !hasAttachments) {
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
    }

    const scrollHeight = measureScrollHeight(ta);
    const hasExplicitNewline = value.includes("\n");
    const fitsSingleLine =
      !hasAttachments &&
      !hasExplicitNewline &&
      scrollHeight <= SINGLE_LINE_PX + 1;

    if (fitsSingleLine) {
      if (multilineRef.current) {
        multilineRef.current = false;
        setIsMultiline(false);
      }
      ta.style.height = `${SINGLE_LINE_PX}px`;
      ta.style.minHeight = `${SINGLE_LINE_PX}px`;
      ta.style.maxHeight = `${SINGLE_LINE_PX}px`;
      ta.style.overflow = "hidden";
      return;
    }

    if (!multilineRef.current) {
      multilineRef.current = true;
      setIsMultiline(true);
    }

    const next = Math.min(Math.max(scrollHeight, SINGLE_LINE_PX), 140);
    ta.style.height = `${next}px`;
    ta.style.minHeight = `${SINGLE_LINE_PX}px`;
    ta.style.maxHeight = "140px";
    ta.style.overflow = scrollHeight > 140 ? "auto" : "hidden";
  }, [value, hasDraft, hasAttachments, isMultiline]);

  return (
    <div
      ref={ref}
      data-demo-composer
      className={cn(
        "flex w-full flex-col",
        isConversationStarted ? "items-stretch" : "items-center",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "relative flex w-full flex-col",
          !isConversationStarted && "justify-center",
        )}
      >
        <AnimatePresence>
          {addMenuOpen ? <DemoAddMenu key="demo-add-menu" /> : null}
        </AnimatePresence>

        <div
          data-prompt-shell
          className={cn(
            "w-full max-w-full border bg-white shadow-[0_8px_24px_-10px_rgba(24,24,27,0.12)] transition-[border-color,box-shadow] duration-200",
            dropHighlight
              ? "border-[#0a84ff]/70 shadow-[0_0_0_3px_rgba(10,132,255,0.18)]"
              : "border-zinc-200/80",
          )}
          style={{ borderRadius: 22 }}
        >
          <AnimatePresence initial={false}>
            {hasAttachments ? (
              <motion.div
                key="demo-attachments"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 overflow-hidden px-2.5 pt-2.5"
              >
                {attachments.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.85, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AttachmentChip file={file} />
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className={cn(
              "flex w-full",
              useCompact
                ? "min-h-[52px] flex-row items-center gap-2 px-2 py-1.5 sm:px-2.5"
                : "flex-col",
            )}
            data-prompt-layout={useCompact ? "compact" : "stacked"}
          >
            <div
              className={cn(
                "min-w-0",
                useCompact
                  ? "order-2 flex min-h-[32px] min-w-0 flex-1 items-center"
                  : "w-full px-2.5 pt-2 pb-0 sm:px-2.5",
              )}
              data-prompt-editor
            >
              <textarea
                ref={textareaRef}
                readOnly
                tabIndex={-1}
                value={value}
                placeholder="Ask anything"
                rows={1}
                className={cn(
                  "prompt-textarea block w-full resize-none overflow-hidden border-0 bg-transparent text-[14px] font-[430] leading-[20px] text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400",
                  useCompact
                    ? "m-0 h-5 min-h-[20px] max-h-5 px-0 py-0"
                    : "min-h-0 px-0 py-1",
                )}
              />
            </div>

            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-1.5 sm:gap-1.5 sm:px-2",
                useCompact && "contents",
              )}
            >
              <div className={cn(useCompact && "order-1")}>
                <button
                  type="button"
                  tabIndex={-1}
                  data-demo-add
                  aria-label="Add content"
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500",
                    addMenuOpen && "bg-zinc-100 text-zinc-800",
                  )}
                >
                  <Plus className="h-4 w-4 opacity-80" strokeWidth={1.75} />
                </button>
              </div>
              <div className={cn("min-w-0 flex-1", useCompact && "hidden")} />
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1",
                  useCompact && "order-3",
                )}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Dictate"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500"
                >
                  <Mic className="h-4 w-4 opacity-80" />
                </button>
                {isGenerating ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-demo-send
                    aria-label="Stop generating"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white transition-transform duration-150 ease-out"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-demo-send
                    aria-label="Send"
                    disabled={!hasDraft && !hasAttachments}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white transition-transform duration-150 ease-out",
                      !hasDraft && !hasAttachments && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isConversationStarted ? (
          <p className="mt-2 px-1 text-center text-[10.5px] leading-4 text-zinc-400">
            Clauxen can make mistakes. Check important info.
          </p>
        ) : null}
      </div>
    </div>
  );
});
