"use client";

import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Globe,
  Paperclip,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptComposeAction = "deep-research";
export type WebSearchMode = "auto" | "off";

type PromptAddMenuItemId = "files" | "web-search" | "deep-research";

type SubmenuId = "web-search";

type PromptAddMenuItem = {
  id: PromptAddMenuItemId;
  label: string;
  description?: string;
  icon: LucideIcon;
  hasSubmenu?: boolean;
  onSelect?: () => void;
};

export type PromptAddMenuPanelProps = {
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  onAddFiles?: () => void;
  onDeepResearch?: () => void;
  webSearchMode?: WebSearchMode;
  onWebSearchModeChange?: (mode: WebSearchMode) => void;
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
      role="menuitem"
      data-prompt-add-menu-row=""
      data-active={active ? "true" : undefined}
      onClick={onSelect}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="focus:outline-none"
    >
      <span data-prompt-add-menu-icon="" aria-hidden>
        <Icon strokeWidth={1.75} />
      </span>
      <span className="shrink-0">{item.label}</span>
      {item.description ? (
        <span className="min-w-0 flex-1 truncate text-[var(--ui-fg-muted)]">
          {item.description}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      {item.hasSubmenu ? (
        <ChevronRight
          data-prompt-add-menu-chevron=""
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
    <div className="flex min-w-[var(--popup-width)] flex-col gap-[var(--menu-item-gap)]">
      {options.map((option) => {
        const selected = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            data-prompt-add-menu-row=""
            data-active={selected ? "true" : undefined}
            onClick={() => onSelect(option.id)}
            className="items-start focus:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium leading-[18px] tracking-[-0.08px] text-[var(--ui-fg)]">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-4 text-[var(--ui-fg-muted)]">
                {option.description}
              </span>
            </span>
            {selected ? (
              <Check
                className="mt-0.5 h-[14px] w-[14px] shrink-0 text-[var(--link)]"
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <span className="mt-0.5 h-[14px] w-[14px] shrink-0" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PromptAddMenuPanel({
  onClose,
  panelRef,
  onAddFiles,
  onDeepResearch,
  webSearchMode = "auto",
  onWebSearchModeChange,
  className,
}: PromptAddMenuPanelProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = panelRef ?? internalRef;
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId | null>(null);

  const items: PromptAddMenuItem[] = [
    ...(onAddFiles
      ? [
          {
            id: "files" as const,
            label: "Add photos & files",
            description: "Upload from computer",
            icon: Paperclip,
            onSelect: () => {
              onClose();
              onAddFiles();
            },
          },
        ]
      : []),
    {
      id: "web-search",
      label: "Web search",
      description: "Find real-time news and info",
      icon: Globe,
      hasSubmenu: true,
      onSelect: () =>
        setActiveSubmenu((active) =>
          active === "web-search" ? null : "web-search",
        ),
    },
    ...(onDeepResearch
      ? [
          {
            id: "deep-research" as const,
            label: "Deep research",
            description: "Get a detailed report",
            icon: Telescope,
            onSelect: onDeepResearch,
          },
        ]
      : []),
  ];

  useEffect(() => {
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
  }, [onClose, activeSubmenu]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      resolvedRef.current
        ?.querySelector<HTMLButtonElement>("[data-prompt-add-menu-row]")
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedRef]);

  const menu = (
    <div
      ref={resolvedRef}
      role="menu"
      aria-label="Composer tools"
      className={cn("relative mt-2 w-full", className)}
      data-prompt-add-menu-root
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        const rows = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "[role=menuitem]",
          ),
        );
        if (!rows.length) return;
        event.preventDefault();
        const index = rows.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) %
                rows.length;
        rows[next].focus();
      }}
    >
      <motion.div
        initial={{ opacity: 0, height: 0, y: -5 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -3 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full overflow-hidden"
      >
        <div data-prompt-add-menu className="w-full overflow-hidden font-sans">
          <div
            data-prompt-add-menu-list=""
            role="presentation"
            style={{
              maxHeight: "min(360px, 50vh)",
            }}
          >
            {items.map((item) => (
              <Fragment key={item.id}>
                <PromptAddMenuRow
                  item={item}
                  active={activeSubmenu === item.id}
                  onHover={() => {
                    if (!item.hasSubmenu) {
                      setActiveSubmenu(null);
                    }
                  }}
                  onSelect={() => item.onSelect?.()}
                />
                {activeSubmenu === item.id && item.id === "web-search" ? (
                  <div className="px-2 pb-2">
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
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return menu;
}
