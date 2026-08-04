"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronDown, Plus, Search, X } from "lucide-react";
import { chrome } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";
import { starterSkillsStructure } from "@/lib/starter-skills-data";

const FEATURED_DESCRIPTIONS: Record<string, string> = {
  "skill-creator":
    "Create new personal skills, improve existing guidance, and shape reliable workflows for Clauxen.",
  adaptyv:
    "Build adaptive workflows and reusable operating guidance for Clauxen, tuned to the way your team works.",
  aeon: "Create structured long-running workflows with context that stays clear, useful, and easy to reuse.",
  "browser-use":
    "Browse pages, inspect interfaces, and carry out web tasks with carefully scoped actions and clear results.",
  "canvas-design":
    "Create polished visual assets, layouts, and documents using thoughtful composition and reusable styles.",
};

function publicSkillName(name: string) {
  return name;
}

function descriptionForSkill(name: string) {
  return (
    FEATURED_DESCRIPTIONS[name] ??
    `Add ${publicSkillName(name).replaceAll("-", " ")} capabilities to Clauxen with reusable instructions and workflows from Shirova.`
  );
}

function PluginsNavIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M13.147 3.147a.5.5 0 1 1 .707.707L11.207 6.5 13.5 8.793l2.646-2.646a.5.5 0 1 1 .707.707L14.208 9.5l2.146 2.146a.5.5 0 1 1-.707.707L15 11.708l-2.646 2.646a4.74 4.74 0 0 1-6.335.335l-2.165 2.165a.5.5 0 1 1-.707-.707l2.165-2.166a4.74 4.74 0 0 1 .335-6.333L8.293 5l-.646-.646a.5.5 0 1 1 .707-.707L10.5 5.793zM6.353 8.354a3.743 3.743 0 0 0 5.292 5.293L14.294 11 9 5.707z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SkillDirectoryDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");

  const directorySkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...starterSkillsStructure]
      .sort((first, second) => {
        if (first.name === "skill-creator") return -1;
        if (second.name === "skill-creator") return 1;
        return first.name.localeCompare(second.name);
      })
      .map((skill) => ({
        name: publicSkillName(skill.name),
        description: descriptionForSkill(skill.name),
      }))
      .filter(
        (skill) =>
          !normalizedQuery ||
          skill.name.toLowerCase().includes(normalizedQuery) ||
          skill.description.toLowerCase().includes(normalizedQuery),
      );
  }, [query]);

  const dialog = (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[var(--overlay-scrim)] p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close directory"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-directory-title"
        className={cn(chrome.overlay.panel, "relative flex max-h-[min(673px,calc(100dvh-1.5rem))] w-full max-w-[min(1024px,calc(100vw-1.5rem))] flex-col text-zinc-900 duration-200 animate-in fade-in zoom-in-95")}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl p-5 sm:p-6">
          <div className="mb-3 flex items-start gap-2">
            <h2
              id="skill-directory-title"
              className="min-w-0 flex-1 truncate font-serif text-[22px] font-medium leading-[26px]"
            >
              Directory
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2 -mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 gap-6 sm:gap-8">
            <aside className="hidden w-[200px] shrink-0 pt-3 sm:block">
              <nav
                className="flex flex-col gap-1"
                aria-label="Directory sections"
              >
                <button
                  type="button"
                  aria-current="true"
                  className="flex items-center gap-3 rounded-lg bg-zinc-100 px-4 py-1.5 app-page-body font-semibold"
                >
                  <BookOpen className="h-5 w-5" />
                  <span>Skills</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-lg px-4 py-1.5 app-page-body transition-colors hover:bg-[var(--ui-hover-wash)]"
                >
                  <span className="grid h-5 w-5 place-items-center">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 6a1 1 0 0 1 1 .999V11h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 10h4v-4H9zm-5 0h4v-4H4zm0-5h4V7H4z"
                        clipRule="evenodd"
                      />
                      <path
                        fillRule="evenodd"
                        d="M16.103 3.005A1 1 0 0 1 17 4v4l-.005.103a1 1 0 0 1-.893.892L16 9h-4a1 1 0 0 1-.995-.897L11 8V4a1 1 0 0 1 1-1h4zM12 8h4V4h-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>Connectors</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-lg px-4 py-1.5 app-page-body transition-colors hover:bg-[var(--ui-hover-wash)]"
                >
                  <PluginsNavIcon className="h-5 w-5" />
                  <span>Plugins</span>
                </button>
              </nav>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-4 pt-2">
              <div className="flex h-8 w-full items-center gap-2 rounded-lg bg-white/70 px-2 shadow-[inset_0_0_0_1px_rgba(11,11,11,0.1)]">
                <Search className="h-4 w-4 shrink-0 text-[#898781]" />
                <input
                  aria-label="Search directory"
                  placeholder="Search skills..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="app-page-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  aria-pressed
                  className="app-page-body shrink-0 rounded-full bg-zinc-100 px-3 py-1"
                >
                  Shirova &amp; Partners
                </button>
                <div className="hidden items-center gap-3 md:flex">
                  {["Filter by", "Sort by"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="app-page-muted flex h-8 min-w-[120px] items-center justify-between rounded-[var(--radius-sm)] border border-[var(--ui-border)] bg-white px-3"
                    >
                      <span>{label}</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <ul
                className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-auto pr-1 sm:grid-cols-2 sm:gap-4"
                aria-label="Shirova and partner skills"
              >
                {directorySkills.map((skill) => (
                  <li key={skill.name}>
                    <article className="app-page-card flex h-full min-h-[132px] flex-col gap-2.5 p-3.5 text-left transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className="app-page-body truncate font-medium"
                            title={skill.name}
                          >
                            /{skill.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[12px] leading-4 text-zinc-500">
                            <span>Shirova</span>
                            <span aria-hidden="true">•</span>
                            <span>Ready to add</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Add ${skill.name}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="line-clamp-4 text-[12px] leading-4 text-zinc-500">
                        {skill.description}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(dialog, document.body);
}
