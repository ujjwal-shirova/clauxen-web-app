"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Briefcase,
  ChevronRight,
  Ellipsis,
  FileText,
  ImagePlus,
  LayoutPanelTop,
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
  PromptAddFilesIcon,
  PromptConnectorsIcon,
  PromptProjectIcon,
  PromptScreenshotIcon,
  PromptStyleIcon,
  PromptWebSearchIcon,
  WriteSkillInstructionsIcon,
} from "./icons";

type PromptMenuItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  trailing?: "chevron" | "shortcut" | "check";
  shortcut?: string;
  active?: boolean;
};

const primaryItems: PromptMenuItem[] = [
  {
    label: "Add files or photos",
    icon: PromptAddFilesIcon,
    trailing: "shortcut",
    shortcut: "Ctrl+U",
  },
  {
    label: "Take a screenshot",
    icon: PromptScreenshotIcon,
  },
  {
    label: "Recent files",
    icon: FileText,
    trailing: "chevron",
  },
];

const centerItems: PromptMenuItem[] = [
  {
    label: "Add to project",
    icon: PromptProjectIcon,
    trailing: "chevron",
  },
  {
    label: "Web search",
    icon: PromptWebSearchIcon,
    trailing: "check",
    active: true,
  },
];

const bottomItems: PromptMenuItem[] = [
  {
    label: "Use style",
    icon: PromptStyleIcon,
    trailing: "chevron",
  },
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

const moreItems: PromptMenuItem[] = [
  {
    label: "Create image",
    icon: ImagePlus,
  },
  {
    label: "Deep research",
    icon: Telescope,
  },
  {
    label: "Canvas",
    icon: LayoutPanelTop,
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
        "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        isActive ? "text-[#2c84db]" : "text-zinc-900",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex icon-xl shrink-0 items-center justify-center">
          <Icon
            className={cn(
              "icon-xl",
              isActive ? "text-[#2c84db]" : "text-zinc-900",
            )}
          />
        </div>
        <span className="truncate font-normal">{item.label}</span>
      </div>

      {item.trailing === "shortcut" && item.shortcut ? (
        <span className="truncate text-right text-[12px] font-[430] leading-4 text-zinc-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {item.shortcut}
        </span>
      ) : null}

      {item.trailing === "chevron" ? (
        <span className="ml-auto flex icon-md items-center justify-center text-zinc-500">
          <ChevronRight className="icon-md" />
        </span>
      ) : null}

      {item.trailing === "check" ? (
        <span className="ml-auto flex icon-md items-center justify-center text-[#2c84db]">
          <CheckIcon className="icon-md" />
        </span>
      ) : null}
    </button>
  );
}

function PromptAddMenuSeparator({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      className="mx-2 my-[6px] h-[0.5px] bg-zinc-900/15"
    />
  );
}

interface PromptAddMenuProps {
  trigger: ReactNode;
  onQuickActionSelect?: (
    action: "image" | "video" | "music" | "deep-research",
  ) => void;
  showImageCreation?: boolean;
}

export function PromptAddMenu({
  trigger,
  onQuickActionSelect,
  showImageCreation = true,
}: PromptAddMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Normal");
  const actionDelayRef = useRef<number | null>(null);
  const styleItems = ["Normal", "Learning", "Concise", "Explanatory", "Formal"];
  const availableMoreItems = showImageCreation
    ? moreItems
    : moreItems.filter((item) => item.label !== "Create image");

  useEffect(() => {
    return () => {
      if (actionDelayRef.current !== null) {
        window.clearTimeout(actionDelayRef.current);
      }
    };
  }, []);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsMoreOpen(false);
    setIsProjectOpen(false);
    setIsSkillsOpen(false);
    setIsStyleOpen(false);
  };
  const selectQuickAction = (action: "image" | "deep-research") => {
    closeMenu();
    if (actionDelayRef.current !== null) {
      window.clearTimeout(actionDelayRef.current);
    }
    actionDelayRef.current = window.setTimeout(() => {
      onQuickActionSelect?.(action);
      actionDelayRef.current = null;
    }, 160);
  };

  return (
    <Popover
      open={isMenuOpen}
      onOpenChange={(open) => {
        setIsMenuOpen(open);
        if (!open) {
          setIsMoreOpen(false);
          setIsProjectOpen(false);
          setIsSkillsOpen(false);
          setIsStyleOpen(false);
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={12}
        className={cn(
          "z-[60] min-w-[192px] max-w-[320px] origin-[var(--radix-popover-content-transform-origin)] rounded-[12px] border border-zinc-200 bg-white p-[6px] font-sans text-[16px] font-normal leading-6 text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl duration-200",
        )}
      >
        <div role="menu" aria-orientation="vertical" className="outline-none">
          {primaryItems.map((item) => (
            <PromptAddMenuItem
              key={item.label}
              item={item}
              onClick={item.trailing === "chevron" ? undefined : closeMenu}
            />
          ))}

          <PromptAddMenuSeparator label="separator-center" />

          {centerItems.map((item) => {
            if (item.label !== "Add to project") {
              return (
                <PromptAddMenuItem
                  key={item.label}
                  item={item}
                  onClick={item.trailing === "chevron" ? undefined : closeMenu}
                />
              );
            }

            return (
              <div
                key={item.label}
                className="relative mt-0.5"
                onMouseEnter={() => setIsProjectOpen(true)}
                onMouseLeave={() => setIsProjectOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={isProjectOpen}
                  onClick={() => setIsProjectOpen((open) => !open)}
                  className={cn(
                    "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                    isProjectOpen && "bg-black/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex icon-xl shrink-0 items-center justify-center">
                      <PromptProjectIcon className="icon-xl text-zinc-900" />
                    </div>
                    <span className="truncate font-normal">Add to project</span>
                  </div>
                  <span className="ml-auto flex icon-md items-center justify-center text-zinc-500">
                    <ChevronRight className="icon-md" />
                  </span>
                </button>

                {isProjectOpen ? (
                  <div className="absolute bottom-[-18px] left-[calc(100%-4px)] z-[70] flex min-w-[192px] max-w-[320px] flex-col rounded-[12px] border border-zinc-200 bg-white p-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex icon-xl shrink-0 items-center justify-center">
                          <Plus className="icon-xl text-zinc-900" />
                        </div>
                        <span className="truncate font-normal">
                          Start a new project
                        </span>
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            className="relative mt-0.5"
            onMouseEnter={() => setIsMoreOpen(true)}
            onMouseLeave={() => setIsMoreOpen(false)}
          >
            <button
              type="button"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((open) => !open)}
              className={cn(
                "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                isMoreOpen && "bg-black/[0.03]",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex icon-xl shrink-0 items-center justify-center">
                  <Ellipsis className="icon-xl text-zinc-900" />
                </div>
                <span className="truncate font-normal">More</span>
              </div>
              <span className="ml-auto flex icon-md items-center justify-center text-zinc-500">
                <ChevronRight className="icon-md" />
              </span>
            </button>

            {isMoreOpen ? (
              <div className="absolute bottom-[-18px] left-[calc(100%-4px)] z-[70] flex min-w-[192px] max-w-[320px] flex-col rounded-[12px] border border-zinc-200 bg-white p-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                {availableMoreItems.map((item) => {
                  const actionByLabel: Record<
                    string,
                    "image" | "deep-research"
                  > = {
                    "Create image": "image",
                    "Deep research": "deep-research",
                  };

                  const quickAction = actionByLabel[item.label];

                  return (
                    <PromptAddMenuItem
                      key={item.label}
                      item={item}
                      onClick={() => {
                        if (quickAction) {
                          selectQuickAction(quickAction);
                        }
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>

          <PromptAddMenuSeparator label="separator-bottom" />

          {bottomItems.map((item) => {
            if (item.label === "Skills") {
              return (
                <div
                  key={item.label}
                  className="relative mt-0.5"
                  onMouseEnter={() => setIsSkillsOpen(true)}
                  onMouseLeave={() => setIsSkillsOpen(false)}
                >
                  <button
                    type="button"
                    aria-expanded={isSkillsOpen}
                    onClick={() => setIsSkillsOpen((open) => !open)}
                    className={cn(
                      "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                      isSkillsOpen && "bg-black/[0.03]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex icon-xl shrink-0 items-center justify-center">
                        <WriteSkillInstructionsIcon className="icon-xl text-zinc-900" />
                      </div>
                      <span className="truncate font-normal">Skills</span>
                    </div>
                    <span className="ml-auto flex icon-md items-center justify-center text-zinc-500">
                      <ChevronRight className="icon-md" />
                    </span>
                  </button>

                  {isSkillsOpen ? (
                    <div className="absolute bottom-[-18px] left-[calc(100%-4px)] z-[70] flex max-h-[324px] min-w-[192px] max-w-[320px] flex-col overflow-x-auto overflow-y-auto rounded-[12px] border border-zinc-200 bg-white p-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                      <button
                        type="button"
                        onClick={closeMenu}
                        className="group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate font-normal">
                            skill-creator
                          </span>
                        </div>
                      </button>

                      <div className="sticky bottom-[-6px] z-10 -mx-[6px] -mb-[6px] bg-white px-[6px] pb-[6px]">
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          className="-mx-[6px] my-[6px] h-[0.5px] bg-zinc-900/15"
                        />
                        <button
                          type="button"
                          onClick={closeMenu}
                          className="group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex icon-xl shrink-0 items-center justify-center">
                              <Briefcase className="icon-xl text-zinc-900" />
                            </div>
                            <span className="truncate font-normal">
                              Manage skills
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }

            if (item.label !== "Use style") {
              return (
                <PromptAddMenuItem
                  key={item.label}
                  item={item}
                  onClick={item.trailing === "chevron" ? undefined : closeMenu}
                />
              );
            }

            return (
              <div
                key={item.label}
                className="relative mt-0.5"
                onMouseEnter={() => setIsStyleOpen(true)}
                onMouseLeave={() => setIsStyleOpen(false)}
              >
                <button
                  type="button"
                  aria-expanded={isStyleOpen}
                  onClick={() => setIsStyleOpen((open) => !open)}
                  className={cn(
                    "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                    isStyleOpen && "bg-black/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex icon-xl shrink-0 items-center justify-center">
                      <PromptStyleIcon className="icon-xl text-zinc-900" />
                    </div>
                    <span className="truncate font-normal">Use style</span>
                  </div>
                  <span className="ml-auto flex icon-md items-center justify-center text-zinc-500">
                    <ChevronRight className="icon-md" />
                  </span>
                </button>

                {isStyleOpen ? (
                  <div className="absolute bottom-[-18px] left-[calc(100%-4px)] z-[70] flex min-w-[192px] max-w-[320px] flex-col rounded-[12px] border border-zinc-200 bg-white p-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl">
                    {styleItems.map((styleName) => {
                      const isActive = selectedStyle === styleName;

                      return (
                        <button
                          key={styleName}
                          type="button"
                          onClick={() => {
                            setSelectedStyle(styleName);
                            closeMenu();
                          }}
                          className={cn(
                            "group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 transition-colors hover:bg-black/[0.03] focus:outline-none",
                            isActive ? "text-[#2c84db]" : "text-zinc-900",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex icon-xl shrink-0 items-center justify-center">
                              <PromptStyleIcon
                                className={cn(
                                  "icon-xl",
                                  isActive
                                    ? "text-[#2c84db]"
                                    : "text-zinc-900",
                                )}
                              />
                            </div>
                            <span className="truncate font-normal">
                              {styleName}
                            </span>
                          </div>
                          {isActive ? (
                            <span className="ml-auto flex icon-md items-center justify-center text-[#2c84db]">
                              <CheckIcon className="icon-md" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    <PromptAddMenuSeparator label="separator-style" />
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="group relative flex min-h-8 w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[14px] leading-5 text-zinc-900 transition-colors hover:bg-black/[0.03] focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex icon-xl shrink-0 items-center justify-center">
                          <PromptStyleIcon className="icon-xl text-zinc-900" />
                        </div>
                        <span className="truncate font-normal">
                          Create & edit styles
                        </span>
                      </div>
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
