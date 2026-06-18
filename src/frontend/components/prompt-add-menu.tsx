"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Brain,
  Briefcase,
  Camera,
  ChevronRight,
  FileText,
  LayoutPanelTop,
  Paperclip,
  Plus,
  Telescope,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend/components/ui/popover";
import { cn } from "@/frontend/lib/utils";
import {
  CheckIcon,
  PromptConnectorsIcon,
  PromptProjectIcon,
  PromptWebSearchIcon,
  WriteSkillInstructionsIcon,
} from "./icons";

type PromptMenuItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  trailing?: "chevron" | "shortcut" | "check";
  shortcut?: string;
  active?: boolean;
  onSelect?: () => void;
};

const primaryItems = (
  handlers: {
    onAddFiles?: () => void;
    onTakeScreenshot?: () => void;
  },
): PromptMenuItem[] => [
  {
    label: "Add files or photos",
    icon: Paperclip,
    trailing: "shortcut",
    shortcut: "Ctrl+U",
    onSelect: handlers.onAddFiles,
  },
  {
    label: "Take a screenshot",
    icon: Camera,
    onSelect: handlers.onTakeScreenshot,
  },
  {
    label: "Recent files",
    icon: FileText,
    trailing: "chevron",
  },
];

const centerItems = (
  webSearchEnabled: boolean,
): PromptMenuItem[] => [
  {
    label: "Add to project",
    icon: PromptProjectIcon,
    trailing: "chevron",
  },
  {
    label: "Web search",
    icon: PromptWebSearchIcon,
    trailing: "check",
    active: webSearchEnabled,
  },
];

const bottomItems: PromptMenuItem[] = [
  {
    label: "Add connectors",
    icon: PromptConnectorsIcon,
  },
  {
    label: "Skills",
    icon: WriteSkillInstructionsIcon,
    trailing: "chevron",
  },
];

function PromptAddMenuItem({
  item,
  onClick,
}: {
  item: PromptMenuItem;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  const isActive = Boolean(item.active);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-7 w-full items-center justify-between rounded-md px-2 py-1 text-left text-[13px] leading-5 transition-colors hover:bg-zinc-100 focus:outline-none",
        isActive ? "text-[#2c84db]" : "text-zinc-800",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "text-[#2c84db]" : "text-zinc-700",
          )}
        />
        <span className="truncate font-normal">{item.label}</span>
      </div>

      {item.trailing === "shortcut" && item.shortcut ? (
        <span className="ml-2 shrink-0 text-[11px] font-medium text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
          {item.shortcut}
        </span>
      ) : null}

      {item.trailing === "chevron" ? (
        <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0 text-zinc-400" />
      ) : null}

      {item.trailing === "check" && isActive ? (
        <CheckIcon className="ml-1 h-3.5 w-3.5 shrink-0 text-[#2c84db]" />
      ) : null}
    </button>
  );
}

function PromptAddMenuSeparator() {
  return <div className="my-1 h-px bg-zinc-200/80" role="separator" />;
}

export type PromptComposeAction = "deep-research" | "canvas";

interface PromptAddMenuProps {
  trigger: ReactNode;
  onQuickActionSelect?: (
    action: "video" | "music",
  ) => void;
  onComposeActionSelect?: (action: PromptComposeAction) => void;
  onAddFiles?: () => void;
  onTakeScreenshot?: () => void;
  onThinkingToggle?: () => void;
  thinkingEnabled?: boolean;
  onWebSearchToggle?: () => void;
  webSearchEnabled?: boolean;
  showComposeActions?: boolean;
  showThinkingToggle?: boolean;
}

export function PromptAddMenu({
  trigger,
  onQuickActionSelect,
  onComposeActionSelect,
  onAddFiles,
  onTakeScreenshot,
  onThinkingToggle,
  thinkingEnabled = false,
  onWebSearchToggle,
  webSearchEnabled = false,
  showComposeActions = true,
  showThinkingToggle = true,
}: PromptAddMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const actionDelayRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (actionDelayRef.current !== null) {
        window.clearTimeout(actionDelayRef.current);
      }
    };
  }, []);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsProjectOpen(false);
    setIsSkillsOpen(false);
  };

  const selectComposeAction = (action: PromptComposeAction) => {
    closeMenu();
    if (actionDelayRef.current !== null) {
      window.clearTimeout(actionDelayRef.current);
    }
    actionDelayRef.current = window.setTimeout(() => {
      onComposeActionSelect?.(action);
      actionDelayRef.current = null;
    }, 160);
  };

  const handleItemSelect = (item: PromptMenuItem) => {
    if (item.trailing === "chevron" && !item.onSelect) return;
    closeMenu();
    item.onSelect?.();
  };

  return (
    <Popover
      open={isMenuOpen}
      onOpenChange={(open) => {
        setIsMenuOpen(open);
        if (!open) {
          setIsProjectOpen(false);
          setIsSkillsOpen(false);
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="ui-menu z-[60] w-[200px] rounded-[10px] border border-zinc-200/90 bg-white p-1 font-sans text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
      >
        <div
          role="menu"
          aria-label="Add agents, context, tools"
          aria-orientation="vertical"
          className="ui-menu__layout outline-none"
        >
          <div className="ui-menu__search-row p-1">
            <div className="ui-input-group rounded-md bg-zinc-100/70 px-2">
              <input
                aria-label="Search menu items"
                placeholder="Add agents, context, tools..."
                className="ui-input-group__input h-7 w-full bg-transparent text-[12.5px] text-zinc-800 outline-none placeholder:text-zinc-400"
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
          </div>
          {primaryItems({ onAddFiles, onTakeScreenshot }).map((item) => (
            <PromptAddMenuItem
              key={item.label}
              item={item}
              onClick={() => handleItemSelect(item)}
            />
          ))}

          {showComposeActions || showThinkingToggle ? (
            <>
              <PromptAddMenuSeparator />
              {showComposeActions ? (
                <>
                  <PromptAddMenuItem
                    item={{ label: "Deep research", icon: Telescope }}
                    onClick={() => selectComposeAction("deep-research")}
                  />
                  <PromptAddMenuItem
                    item={{ label: "Canvas", icon: LayoutPanelTop }}
                    onClick={() => selectComposeAction("canvas")}
                  />
                </>
              ) : null}
              {showThinkingToggle ? (
                <PromptAddMenuItem
                  item={{
                    label: "Thinking",
                    icon: Brain,
                    trailing: "check",
                    active: thinkingEnabled,
                  }}
                  onClick={() => {
                    closeMenu();
                    onThinkingToggle?.();
                  }}
                />
              ) : null}
            </>
          ) : null}

          <PromptAddMenuSeparator />

          {centerItems(webSearchEnabled).map((item) => {
            if (item.label === "Web search") {
              return (
                <PromptAddMenuItem
                  key={item.label}
                  item={item}
                  onClick={() => {
                    closeMenu();
                    onWebSearchToggle?.();
                  }}
                />
              );
            }

            if (item.label !== "Add to project") {
              return (
                <PromptAddMenuItem
                  key={item.label}
                  item={item}
                  onClick={() => handleItemSelect(item)}
                />
              );
            }

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setIsProjectOpen(true)}
                onMouseLeave={() => setIsProjectOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={isProjectOpen}
                  onClick={() => setIsProjectOpen((open) => !open)}
                  className={cn(
                    "group flex min-h-7 w-full items-center justify-between rounded-md px-2 py-1 text-left text-[13px] leading-5 text-zinc-800 transition-colors hover:bg-zinc-100",
                    isProjectOpen && "bg-zinc-100",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PromptProjectIcon className="h-4 w-4 text-zinc-700" />
                    <span className="truncate font-normal">Add to project</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {isProjectOpen ? (
                  <div className="absolute bottom-0 left-[calc(100%-2px)] z-[70] w-[188px] rounded-[10px] border border-zinc-200/90 bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-zinc-800 hover:bg-zinc-100"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} />
                      <span>Start a new project</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          <PromptAddMenuSeparator />

          {bottomItems.map((item) => {
            if (item.label !== "Skills") {
              return (
                <PromptAddMenuItem
                  key={item.label}
                  item={item}
                  onClick={() => handleItemSelect(item)}
                />
              );
            }

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setIsSkillsOpen(true)}
                onMouseLeave={() => setIsSkillsOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={isSkillsOpen}
                  onClick={() => setIsSkillsOpen((open) => !open)}
                  className={cn(
                    "group flex min-h-7 w-full items-center justify-between rounded-md px-2 py-1 text-left text-[13px] leading-5 text-zinc-800 transition-colors hover:bg-zinc-100",
                    isSkillsOpen && "bg-zinc-100",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <WriteSkillInstructionsIcon className="h-4 w-4 text-zinc-700" />
                    <span className="truncate font-normal">Skills</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {isSkillsOpen ? (
                  <div className="absolute bottom-0 left-[calc(100%-2px)] z-[70] max-h-[280px] w-[188px] overflow-y-auto rounded-[10px] border border-zinc-200/90 bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="flex min-h-7 w-full items-center rounded-md px-2 py-1 text-left text-[13px] text-zinc-800 hover:bg-zinc-100"
                    >
                      skill-creator
                    </button>
                    <PromptAddMenuSeparator />
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-zinc-800 hover:bg-zinc-100"
                    >
                      <Briefcase className="h-4 w-4" strokeWidth={1.75} />
                      <span>Manage skills</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
