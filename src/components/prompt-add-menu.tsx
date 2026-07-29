"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Check,
  ChevronRight,
  Globe,
  Paperclip,
  Plug,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";

export type PromptComposeAction = "deep-research";
export type WebSearchMode = "auto" | "off";
export type ThinkingMode = "on" | "off";

type PromptAddMenuItemId =
  | "files"
  | "plugins"
  | "skills"
  | "web-search"
  | "thinking";

type SubmenuId = "plugins" | "skills" | "web-search" | "thinking";

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
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAddFiles?: () => void;
  webSearchMode?: WebSearchMode;
  onWebSearchModeChange?: (mode: WebSearchMode) => void;
  thinkingMode?: ThinkingMode;
  onThinkingModeChange?: (mode: ThinkingMode) => void;
  onOpenPlugins?: () => void;
  onOpenSkills?: () => void;
  className?: string;
};

const MENU_GAP_PX = 8;
/** Flyout sits just outside the main menu border (matches Claude-style nested menus). */
const SUBMENU_GAP_PX = 4;

function PromptAddMenuRow({
  item,
  active,
  onSelect,
  onHover,
  rowRef,
}: {
  item: PromptAddMenuItem;
  active?: boolean;
  onSelect: () => void;
  onHover?: () => void;
  rowRef?: (node: HTMLButtonElement | null) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      ref={rowRef}
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

function ToggleSubmenu<T extends string>({
  options,
  mode,
  onSelect,
}: {
  options: Array<{
    id: T;
    label: string;
    description: string;
  }>;
  mode: T;
  onSelect: (mode: T) => void;
}) {
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

function useAnchoredMenuPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  placement: "above" | "below",
) {
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    // Measure the primary panel only — ignore the flyout so opening a submenu
    // does not re-anchor or jump the main menu.
    const panel =
      menu.querySelector<HTMLElement>("[data-prompt-add-menu]") ?? menu;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportPadding = 12;

    let left = anchorRect.left;
    const maxLeft = window.innerWidth - panelRect.width - viewportPadding;
    left = Math.max(viewportPadding, Math.min(left, maxLeft));

    let top: number;
    if (placement === "above") {
      // Always stay above the + trigger so welcome chips under the composer
      // remain visible. Prefer clipping at the viewport top over covering chips.
      const preferredTop = anchorRect.top - panelRect.height - MENU_GAP_PX;
      if (preferredTop >= viewportPadding) {
        top = preferredTop;
      } else if (preferredTop + panelRect.height + MENU_GAP_PX <= anchorRect.top) {
        top = preferredTop;
      } else {
        top = Math.max(4, preferredTop);
      }
    } else {
      top = anchorRect.bottom + MENU_GAP_PX;
      const maxTop = window.innerHeight - panelRect.height - viewportPadding;
      top = Math.max(viewportPadding, Math.min(top, maxTop));
    }

    setPosition({
      position: "fixed",
      top,
      left,
      zIndex: 80,
      visibility: "visible",
    });
  }, [anchorRef, menuRef, placement]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition({ visibility: "hidden" });
      return;
    }

    updatePosition();

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  });

  return position;
}

export function PromptAddMenuPanel({
  open,
  placement,
  anchorRef,
  onClose,
  panelRef,
  onAddFiles,
  webSearchMode = "auto",
  onWebSearchModeChange,
  thinkingMode = "off",
  onThinkingModeChange,
  onOpenPlugins,
  onOpenSkills,
  className,
}: PromptAddMenuPanelProps) {
  const isClient = useIsClient();
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = panelRef ?? internalRef;
  const rowRefs = useRef<Partial<Record<SubmenuId, HTMLButtonElement | null>>>(
    {},
  );
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);
  const [submenuTopPx, setSubmenuTopPx] = useState(0);
  const [submenuSide, setSubmenuSide] = useState<"right" | "left">("right");

  const menuPosition = useAnchoredMenuPosition(
    open,
    anchorRef,
    resolvedRef,
    placement,
  );

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
    {
      id: "thinking",
      label: "Thinking",
      icon: Brain,
      hasSubmenu: true,
      onSelect: () => setActiveSubmenu("thinking"),
    },
  ];

  const syncSubmenuPlacement = useCallback(
    (submenu: SubmenuId | null) => {
      if (!submenu) return;
      const menu = resolvedRef.current;
      const row = rowRefs.current[submenu];
      if (!menu || !row) return;
      setSubmenuTopPx(row.offsetTop);

      const menuRect = menu.getBoundingClientRect();
      const estimatedSubmenuWidth = 236;
      const spaceRight =
        window.innerWidth - menuRect.right - SUBMENU_GAP_PX - 12;
      setSubmenuSide(spaceRight >= estimatedSubmenuWidth ? "right" : "left");
    },
    [resolvedRef],
  );

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

  useLayoutEffect(() => {
    syncSubmenuPlacement(activeSubmenu);
  }, [activeSubmenu, syncSubmenuPlacement, open]);

  if (!open || !isClient) return null;

  const menu = (
    <div
      ref={resolvedRef}
      style={menuPosition}
      className={cn("relative w-max max-w-[min(100vw-24px,320px)]", className)}
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
              rowRef={(node) => {
                if (item.hasSubmenu) {
                  rowRefs.current[item.id as SubmenuId] = node;
                }
              }}
              onHover={() => {
                if (item.hasSubmenu) {
                  setActiveSubmenu(item.id as SubmenuId);
                  syncSubmenuPlacement(item.id as SubmenuId);
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
          initial={{
            opacity: 0,
            x: submenuSide === "right" ? -4 : 4,
            scale: 0.98,
          }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{
            opacity: 0,
            x: submenuSide === "right" ? -2 : 2,
            scale: 0.98,
          }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          style={{ top: submenuTopPx }}
          className={cn(
            "absolute z-10 overflow-hidden rounded-[16px] border border-zinc-200/90 bg-white shadow-[0_12px_40px_-18px_rgba(24,24,27,0.45)]",
            submenuSide === "right"
              ? "left-[calc(100%+4px)]"
              : "right-[calc(100%+4px)]",
            // Narrow viewports: stack the flyout under the main menu instead.
            "max-sm:left-0 max-sm:right-0 max-sm:top-[calc(100%+6px)] max-sm:bottom-auto",
          )}
          onMouseEnter={() => setActiveSubmenu(activeSubmenu)}
        >
          {activeSubmenu === "web-search" ? (
            <ToggleSubmenu
              mode={webSearchMode}
              options={[
                {
                  id: "auto" as const,
                  label: "Auto",
                  description: "Browses the web when needed",
                },
                {
                  id: "off" as const,
                  label: "Off",
                  description: "No web access",
                },
              ]}
              onSelect={(mode) => {
                onWebSearchModeChange?.(mode);
                onClose();
              }}
            />
          ) : null}
          {activeSubmenu === "thinking" ? (
            <ToggleSubmenu
              mode={thinkingMode}
              options={[
                {
                  id: "on" as const,
                  label: "On",
                  description: "Extended reasoning before answering",
                },
                {
                  id: "off" as const,
                  label: "Off",
                  description: "Answer without extended reasoning",
                },
              ]}
              onSelect={(mode) => {
                onThinkingModeChange?.(mode);
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

  return createPortal(menu, document.body);
}
