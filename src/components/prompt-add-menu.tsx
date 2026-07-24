"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Globe,
  Paperclip,
  Plug,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptComposeAction = "deep-research";
export type WebSearchMode = "auto" | "off";

type PromptAddMenuItemId = "files" | "plugins" | "skills" | "web-search";

type PromptAddMenuItem = {
  id: PromptAddMenuItemId;
  label: string;
  icon: LucideIcon;
  hasSubmenu?: boolean;
  onSelect?: () => void;
};

export type PromptAddMenuPanelProps = {
  open: boolean;
  placement: "above" | "below";
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAddFiles?: () => void;
  webSearchMode?: WebSearchMode;
  onWebSearchModeChange?: (mode: WebSearchMode) => void;
  onOpenPlugins?: () => void;
  onOpenSkills?: () => void;
  className?: string;
};

function PromptAddMenuRow({
  item,
  active,
  onSelect,
  onHover,
}: {
  item: PromptAddMenuItem;
  active?: boolean;
  onSelect: () => void;
  onHover?: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn(
        "group flex w-full min-h-[40px] items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors focus:outline-none",
        active ? "bg-zinc-100/90" : "hover:bg-zinc-100/90 focus-visible:bg-zinc-100/90",
      )}
    >
      <Icon
        className="h-[18px] w-[18px] shrink-0 text-zinc-700"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[14px] font-[430] leading-5 text-zinc-900">
        {item.label}
      </span>
      {item.hasSubmenu ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-400"
          strokeWidth={1.75}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

function WebSearchSubmenu({
  mode,
  onSelect,
}: {
  mode: WebSearchMode;
  onSelect: (mode: WebSearchMode) => void;
}) {
  const options: Array<{
    id: WebSearchMode;
    label: string;
    description: string;
  }> = [
    {
      id: "auto",
      label: "Auto",
      description: "Browses the web when needed",
    },
    {
      id: "off",
      label: "Off",
      description: "No web access",
    },
  ];

  return (
    <div className="flex min-w-[220px] flex-col gap-0.5 p-1.5">
      {options.map((option) => {
        const selected = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={cn(
              "flex w-full items-start gap-2 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-zinc-100/90 focus:outline-none focus-visible:bg-zinc-100/90",
              selected && "bg-zinc-50",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold leading-5 text-zinc-900">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-zinc-500">
                {option.description}
              </span>
            </span>
            {selected ? (
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-[#3a83f7]"
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlaceholderSubmenu({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-w-[200px] flex-col gap-2 p-3">
      <div>
        <p className="text-[13.5px] font-semibold leading-5 text-zinc-900">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-4 text-zinc-500">{body}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-[10px] bg-zinc-900 px-2.5 py-1.5 text-left text-[12.5px] font-medium text-white transition-colors hover:bg-zinc-800"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PromptAddMenuPanel({
  open,
  placement,
  onClose,
  panelRef,
  onAddFiles,
  webSearchMode = "auto",
  onWebSearchModeChange,
  onOpenPlugins,
  onOpenSkills,
  className,
}: PromptAddMenuPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = panelRef ?? internalRef;
  const [activeSubmenu, setActiveSubmenu] = useState<
    null | "plugins" | "skills" | "web-search"
  >(null);

  const items: PromptAddMenuItem[] = [
    {
      id: "files",
      label: "Add files & photos",
      icon: Paperclip,
      onSelect: () => {
        onClose();
        onAddFiles?.();
      },
    },
    {
      id: "plugins",
      label: "Plugins",
      icon: Plug,
      hasSubmenu: true,
      onSelect: () => setActiveSubmenu("plugins"),
    },
    {
      id: "skills",
      label: "Skills",
      icon: ScrollText,
      hasSubmenu: true,
      onSelect: () => setActiveSubmenu("skills"),
    },
    {
      id: "web-search",
      label: "Web search",
      icon: Globe,
      hasSubmenu: true,
      onSelect: () => setActiveSubmenu("web-search"),
    },
  ];

  useEffect(() => {
    if (!open) {
      setActiveSubmenu(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (activeSubmenu) {
          setActiveSubmenu(null);
          return;
        }
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, activeSubmenu]);

  if (!open) return null;

  return (
    <div
      ref={resolvedRef}
      className={cn(
        "relative w-max max-w-[min(100%,320px)]",
        className,
      )}
      data-prompt-add-menu-root
    >
      <motion.div
        key={`prompt-add-menu-${placement}`}
        data-prompt-add-menu
        data-prompt-add-menu-placement={placement}
        initial={{ opacity: 0, y: placement === "below" ? -8 : 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: placement === "below" ? -6 : 6, scale: 0.985 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        className="w-[240px] overflow-visible rounded-[18px] border border-zinc-200/90 bg-white font-sans shadow-[0_12px_40px_-18px_rgba(24,24,27,0.45)]"
      >
        <div className="flex flex-col gap-0.5 p-1.5">
          {items.map((item) => (
            <PromptAddMenuRow
              key={item.id}
              item={item}
              active={activeSubmenu === item.id}
              onHover={() => {
                if (item.hasSubmenu) {
                  setActiveSubmenu(
                    item.id as "plugins" | "skills" | "web-search",
                  );
                } else {
                  setActiveSubmenu(null);
                }
              }}
              onSelect={() => item.onSelect?.()}
            />
          ))}
        </div>
      </motion.div>

      {activeSubmenu ? (
        <motion.div
          key={`prompt-add-submenu-${activeSubmenu}`}
          data-prompt-add-submenu={activeSubmenu}
          initial={{ opacity: 0, x: -4, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -2, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            "absolute left-[calc(100%+6px)] z-10 overflow-hidden rounded-[16px] border border-zinc-200/90 bg-white shadow-[0_12px_40px_-18px_rgba(24,24,27,0.45)]",
            placement === "below" ? "top-0" : "bottom-0",
            // Keep submenu on-screen on narrow viewports by flipping below the row.
            "max-sm:left-0 max-sm:right-0 max-sm:top-[calc(100%+6px)] max-sm:bottom-auto",
          )}
          onMouseEnter={() => setActiveSubmenu(activeSubmenu)}
        >
          {activeSubmenu === "web-search" ? (
            <WebSearchSubmenu
              mode={webSearchMode}
              onSelect={(mode) => {
                onWebSearchModeChange?.(mode);
                onClose();
              }}
            />
          ) : null}
          {activeSubmenu === "plugins" ? (
            <PlaceholderSubmenu
              title="Plugins"
              body="Connect tools and apps to use in chat."
              actionLabel="Browse plugins"
              onAction={() => {
                onClose();
                onOpenPlugins?.();
              }}
            />
          ) : null}
          {activeSubmenu === "skills" ? (
            <PlaceholderSubmenu
              title="Skills"
              body="Reusable instructions the assistant can follow."
              actionLabel="Manage skills"
              onAction={() => {
                onClose();
                onOpenSkills?.();
              }}
            />
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}
