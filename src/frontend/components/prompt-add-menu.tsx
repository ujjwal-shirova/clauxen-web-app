"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion } from "framer-motion";
import {
  Globe,
  ImageIcon,
  Paperclip,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { PromptInlineMode } from "@/frontend/components/prompt-inline-mode-chip";

export type PromptComposeAction = "deep-research";

type PromptAddMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
  onSelect?: () => void;
};

export type PromptAddMenuPanelProps = {
  open: boolean;
  placement: "above" | "below";
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  onComposeActionSelect?: (action: PromptComposeAction) => void;
  onInlineModeSelect?: (mode: PromptInlineMode) => void;
  onAddFiles?: () => void;
  onTakeScreenshot?: () => void;
  showComposeActions?: boolean;
  className?: string;
};

function buildMenuItems({
  onAddFiles,
  onTakeScreenshot,
  onComposeActionSelect,
  onInlineModeSelect,
  showComposeActions,
  onClose,
}: Omit<
  PromptAddMenuPanelProps,
  "open" | "placement" | "className" | "panelRef"
>): PromptAddMenuItem[] {
  const items: PromptAddMenuItem[] = [
    {
      id: "files",
      label: "Add photos & files",
      description: "Upload from computer",
      icon: Paperclip,
      onSelect: () => {
        onClose();
        onAddFiles?.();
      },
    },
    {
      id: "image",
      label: "Create image",
      description: "Visualize anything",
      icon: ImageIcon,
      iconClassName: "text-violet-500",
      onSelect: () => {
        onClose();
        onInlineModeSelect?.("create-image");
      },
    },
    {
      id: "web-search",
      label: "Web search",
      description: "Find real-time news and info",
      icon: Globe,
      iconClassName: "text-sky-500",
      onSelect: () => {
        onClose();
        onInlineModeSelect?.("web-search");
      },
    },
  ];

  if (showComposeActions) {
    items.push({
      id: "deep-research",
      label: "Deep research",
      description: "Get a detailed report",
      icon: Telescope,
      iconClassName: "text-blue-500",
      onSelect: () => {
        onClose();
        onComposeActionSelect?.("deep-research");
      },
    });
  }

  return items;
}

function PromptAddMenuRow({
  item,
  onSelect,
}: {
  item: PromptAddMenuItem;
  onSelect: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full min-h-[34px] items-center gap-2 rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-zinc-100/90 focus:outline-none focus-visible:bg-zinc-100/90"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-zinc-200/80 bg-white">
        <Icon
          className={cn("h-3.5 w-3.5 text-zinc-700", item.iconClassName)}
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
    </button>
  );
}

export function PromptAddMenuPanel({
  open,
  placement,
  onClose,
  panelRef,
  onComposeActionSelect,
  onInlineModeSelect,
  onAddFiles,
  onTakeScreenshot,
  showComposeActions = true,
  className,
}: PromptAddMenuPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = panelRef ?? internalRef;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const items = buildMenuItems({
    onClose,
    onComposeActionSelect,
    onInlineModeSelect,
    onAddFiles,
    onTakeScreenshot,
    showComposeActions,
  });

  const filteredItems = searchQuery.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          item.description
            .toLowerCase()
            .includes(searchQuery.trim().toLowerCase()),
      )
    : items;

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <motion.div
      ref={resolvedRef}
      key={`prompt-add-menu-${placement}`}
      data-prompt-add-menu
      data-prompt-add-menu-placement={placement}
      initial={{ opacity: 0, y: placement === "below" ? -10 : 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: placement === "below" ? -8 : 8, scale: 0.985 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        "w-full overflow-hidden rounded-[14px] border border-zinc-200/90 bg-white font-sans shadow-[0_8px_28px_-20px_rgba(24,24,27,0.28)]",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 p-1">
        {filteredItems.map((item) => (
          <PromptAddMenuRow
            key={item.id}
            item={item}
            onSelect={() => item.onSelect?.()}
          />
        ))}
      </div>
      <div className="border-t border-zinc-100 px-1.5 py-1">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Type to search plugins, files & skills"
          aria-label="Search plugins, files, and skills"
          className="w-full rounded-md border-0 bg-transparent px-1.5 py-1.5 text-[11.5px] leading-4 text-zinc-800 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:bg-zinc-50/90 focus:outline-none focus:ring-0"
          onKeyDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        />
      </div>
    </motion.div>
  );
}
