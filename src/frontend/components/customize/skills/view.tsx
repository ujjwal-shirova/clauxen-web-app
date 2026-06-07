"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Code2,
  EllipsisVertical,
  Eye,
  Info,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { SkillsMiddleList } from "./middle-list";
import { CustomizeMobileHeader } from "../customize-mobile-header";
import { useIsMobile } from "@/frontend/hooks/use-mobile";
import { cn } from "@/frontend/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";

function titleFromSelection(path: string | null) {
  if (!path || path.startsWith("user:")) return "personal skill";
  return path
    .split("/")
    .pop()!
    .replace(/claude/gi, "clauxen")
    .replaceAll("-", " ");
}

function SkillDetailPanel({ selectedPath }: { selectedPath: string | null }) {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const title = titleFromSelection(selectedPath);
  const heading = title.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50">
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[940px] flex-col px-5 pb-5 pt-2 text-zinc-900 sm:px-8">
        <header className="flex min-h-12 shrink-0 items-start justify-between border-b border-zinc-200 pb-2 pt-3">
          <h2 className="min-w-0 truncate text-[18px] font-semibold leading-6">
            {title}
          </h2>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? "Disable skill" : "Enable skill"}
              onClick={() => setEnabled((value) => !value)}
              className={cn(
                "flex h-[22px] w-10 shrink-0 rounded-full p-[2px] transition-colors duration-200",
                enabled ? "bg-[#2a78d6]" : "bg-[#d1d0cc]",
              )}
            >
              <span
                className={cn(
                  "h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200",
                  enabled && "translate-x-[18px]",
                )}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More options for ${title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 data-[state=open]:bg-black/5"
                >
                  <EllipsisVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="z-[60] min-w-[132px] rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
              >
                <DropdownMenuItem className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] focus:bg-black/5">
                  <MessageCircle className="h-5 w-5" />
                  <span>Try in chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-2 my-1.5 h-px bg-zinc-900/15" />
                <DropdownMenuItem className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] text-[#8d2525] focus:bg-[#8d2525]/5 focus:text-[#8d2525]">
                  <Trash2 className="h-5 w-5" />
                  <span>Uninstall</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <dl className="flex shrink-0 flex-col gap-3.5 py-4 text-[13px] sm:flex-row sm:flex-wrap sm:gap-x-12">
          <div>
            <dt className="mb-1 text-[#7c7b77]">Added by</dt>
            <dd className="text-[14px] text-zinc-900">Shirova</dd>
          </div>
          <div>
            <dt className="mb-1 text-[#7c7b77]">Trigger</dt>
            <dd className="border-b border-dotted border-[#8b8985] pb-0.5 text-[14px]">
              Slash command + auto
            </dd>
          </div>
          <div className="basis-full">
            <dt className="mb-1.5 flex items-center gap-2 text-[#7c7b77]">
              Description
              <Info className="h-4 w-4" />
            </dt>
            <dd className="max-w-[850px] text-[14px] leading-5 text-zinc-700">
              Create personal workflows, preferences, and reusable guidance for
              Clauxen. Use this skill whenever you want Clauxen to follow your
              preferred processes, style, and expertise with clear instructions.
            </dd>
          </div>
        </dl>

        <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200 pt-4">
          <article className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="absolute right-4 top-4 z-10 flex rounded-lg bg-[#f1f0ee] p-1">
              <button
                type="button"
                aria-label="Preview skill"
                aria-pressed={mode === "preview"}
                onClick={() => setMode("preview")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-all",
                  mode === "preview" && "bg-white text-zinc-900 shadow-sm",
                )}
              >
                <Eye className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                aria-label="View skill source"
                aria-pressed={mode === "code"}
                onClick={() => setMode("code")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-all",
                  mode === "code" && "bg-white text-zinc-900 shadow-sm",
                )}
              >
                <Code2 className="h-[18px] w-[18px]" />
              </button>
            </div>

            {mode === "preview" ? (
              <div className="h-full w-full overflow-y-auto px-6 pb-6 pt-16 font-serif text-[#141414] sm:px-8">
                <h1 className="mb-3 text-[27px] font-semibold leading-tight">
                  {heading}
                </h1>
                <p className="mb-5 max-w-[700px] text-[16px] leading-6">
                  A skill for creating personal workflows and iteratively
                  improving how Clauxen helps you.
                </p>
                <p className="mb-3 text-[16px] leading-6">
                  At a high level, working with this skill goes like this:
                </p>
                <ul className="max-w-[700px] list-disc space-y-2 pl-7 text-[16px] leading-6">
                  <li>
                    Decide what you want the skill to do and how it should
                    respond
                  </li>
                  <li>
                    Write instructions, examples, and any reusable references
                  </li>
                  <li>Try a few prompts with Clauxen and review the results</li>
                  <li>
                    Refine the skill until it reliably supports your workflow
                  </li>
                </ul>
              </div>
            ) : (
              <pre className="m-5 mt-14 h-[calc(100%_-_4.75rem)] w-[calc(100%_-_2.5rem)] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-5 font-mono text-[13px] leading-6 text-zinc-700">
                {`# ${heading}\n\nA personal skill maintained by Shirova for Clauxen.\n\n## Instructions\n- Follow the user's workflow and style preferences.\n- Keep outputs clear, useful, and consistent.\n- Improve guidance as new examples are added.`}
              </pre>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

export function SkillsView() {
  const isMobile = useIsMobile();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(
    "skill-creator",
  );
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  const handleSelectSkill = useCallback(
    (path: string) => {
      setSelectedSkill(path);
      if (isMobile) setMobilePane("detail");
    },
    [isMobile],
  );

  const detailTitle = useMemo(
    () => titleFromSelection(selectedSkill),
    [selectedSkill],
  );
  const showList = !isMobile || mobilePane === "list";
  const showDetail = !isMobile || mobilePane === "detail";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className={cn(
          "min-h-0 min-w-0",
          isMobile
            ? showList
              ? "flex flex-1 flex-col"
              : "hidden"
            : "flex shrink-0",
        )}
      >
        <SkillsMiddleList
          selectedSkill={selectedSkill}
          onSelectSkill={handleSelectSkill}
        />
      </div>
      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50",
          isMobile && !showDetail && "hidden",
        )}
      >
        {isMobile && showDetail && (
          <CustomizeMobileHeader
            title={detailTitle}
            onBack={() => setMobilePane("list")}
          />
        )}
        <SkillDetailPanel selectedPath={selectedSkill} />
      </main>
    </div>
  );
}
