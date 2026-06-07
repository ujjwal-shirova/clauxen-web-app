"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Plus,
  Search,
  X,
} from "lucide-react";
import * as customizeApi from "@/frontend/lib/api/customize";
import type { ApiSkill } from "@/frontend/lib/api/customize";
import { useAuth } from "@/frontend/hooks/use-auth";
import { cn } from "@/frontend/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { SkillDirectoryDialog } from "./directory";
import {
  CreateWithClaudeIcon,
  UploadSkillIcon,
  WriteSkillInstructionsIcon,
} from "@/frontend/components/icons";

const InstructionsDialog = dynamic(
  () => import("./instructions-dialog").then((mod) => mod.InstructionsDialog),
  {
    ssr: false,
  },
);
const UploadSkillDialog = dynamic(
  () => import("./upload-dialog").then((mod) => mod.UploadSkillDialog),
  {
    ssr: false,
  },
);

const StorefrontIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 256 256"
    aria-hidden="true"
    className={className}
  >
    <path d="M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,24,24,0,0,1-11-21.26v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z" />
  </svg>
);

interface SkillsMiddleListProps {
  selectedSkill?: string | null;
  onSelectSkill?: (path: string) => void;
  className?: string;
}

export function SkillsMiddleList({
  selectedSkill: selectedSkillProp,
  onSelectSkill,
  className,
}: SkillsMiddleListProps = {}) {
  const auth = useAuth();
  const [userSkills, setUserSkills] = useState<ApiSkill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [internalSelectedSkill, setInternalSelectedSkill] = useState<
    string | null
  >(null);
  const selectedSkill = selectedSkillProp ?? internalSelectedSkill;
  const [searchQuery, setSearchQuery] = useState("");
  const [isInstructionsDialogOpen, setIsInstructionsDialogOpen] =
    useState(false);
  const [isUploadSkillDialogOpen, setIsUploadSkillDialogOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);

  const handleSelectSkill = useCallback(
    (path: string) => {
      if (onSelectSkill) {
        onSelectSkill(path);
      } else {
        setInternalSelectedSkill(path);
      }
    },
    [onSelectSkill],
  );

  const refreshUserSkills = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const { skills } = await customizeApi.listSkills();
      setUserSkills(skills);
    } catch {
      setUserSkills([]);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    void refreshUserSkills();
  }, [refreshUserSkills]);

  const handleSaveSkill = useCallback(
    async (input: { title: string; instructions: string }) => {
      await customizeApi.saveSkill(input);
      await refreshUserSkills();
    },
    [refreshUserSkills],
  );

  const filteredPersonalSkills = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return userSkills.filter(
      (skill) =>
        !normalizedQuery ||
        String(skill.title ?? "")
          .toLowerCase()
          .includes(normalizedQuery),
    );
  }, [searchQuery, userSkills]);
  const showSkillCreator =
    !searchQuery.trim() ||
    "skill-creator".includes(searchQuery.trim().toLowerCase());

  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 shrink-0 flex-col border-zinc-200 bg-zinc-50 font-sans md:w-[320px] md:border-r",
        className,
      )}
    >
      {isSearching ? (
        <div className="flex min-h-[52px] shrink-0 items-center justify-between bg-zinc-50 px-4 py-3 duration-200 animate-in fade-in sm:px-6">
          <div className="flex flex-1 items-center">
            <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3">
              <Search className="h-4 w-4 text-zinc-800 opacity-60" />
              <input
                type="text"
                placeholder="Search personal skill"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                maxLength={200}
                autoComplete="off"
                autoFocus
                className="flex-1 border-none bg-transparent text-[12px] text-zinc-800 outline-none"
              />
            </div>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100"
            >
              <X className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[52px] shrink-0 items-center justify-between bg-zinc-50 px-4 py-3 sm:px-6">
          <h2 className="text-[16px] font-semibold text-zinc-900">Skills</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-800 transition-colors hover:bg-zinc-100"
              aria-label="Search skills"
            >
              <Search className="h-5 w-5 opacity-70" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-800 transition-colors hover:bg-zinc-100 data-[state=open]:bg-black/5"
                  aria-label="Add skill"
                >
                  <Plus className="h-5 w-5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                collisionPadding={12}
                className="z-[60] min-w-[min(260px,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
              >
                <DropdownMenuItem
                  onSelect={() => setIsDirectoryOpen(true)}
                  className="grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] focus:bg-black/5"
                >
                  <div className="flex w-full items-center gap-2">
                    <StorefrontIcon className="h-4 w-4 shrink-0 text-zinc-700" />
                    <span className="truncate">Browse skills</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex min-h-8 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] text-zinc-700 outline-none focus:bg-black/5 data-[state=open]:bg-black/5 data-[state=open]:text-zinc-700">
                    <Plus className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      Create skill
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    sideOffset={2}
                    alignOffset={-2}
                    className="z-[70] min-w-[min(232px,calc(100vw-2.5rem))] rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
                  >
                    <DropdownMenuItem
                      onSelect={() => setIsInstructionsDialogOpen(true)}
                      className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] focus:bg-black/5"
                    >
                      <CreateWithClaudeIcon className="h-5 w-5 shrink-0 text-zinc-700" />
                      <span className="truncate">Create with Clauxen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setIsInstructionsDialogOpen(true)}
                      className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] focus:bg-black/5"
                    >
                      <WriteSkillInstructionsIcon className="h-5 w-5 shrink-0 text-zinc-700" />
                      <span className="truncate">Write skill instructions</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setIsUploadSkillDialogOpen(true)}
                      className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-[430] leading-[19.6px] focus:bg-black/5"
                    >
                      <UploadSkillIcon className="h-5 w-5 shrink-0 text-zinc-700" />
                      <span className="truncate">Upload a skill</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-semibold uppercase tracking-tight text-zinc-500">
          <ChevronRight className="h-3.5 w-3.5 rotate-90" />
          <span>Personal skill</span>
        </div>
        {showSkillCreator || filteredPersonalSkills.length > 0 ? (
          <div className="mt-1 flex flex-col gap-1">
            {showSkillCreator && (
              <button
                type="button"
                onClick={() => handleSelectSkill("skill-creator")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-zinc-100",
                  selectedSkill === "skill-creator" && "bg-zinc-100",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-black/5 bg-white shadow-sm">
                  <BookOpen className="h-4 w-4 text-zinc-500" />
                </span>
                <span className="truncate font-semibold">skill-creator</span>
              </button>
            )}
            {filteredPersonalSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSelectSkill(`user:${skill.id}`)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-zinc-100",
                  selectedSkill === `user:${skill.id}` && "bg-zinc-100",
                )}
              >
                <FileText className="h-3.5 w-3.5 text-zinc-500" />
                <span className="truncate">{String(skill.title ?? "")}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mx-2 mt-3 rounded-xl border border-dashed border-zinc-200 bg-white/50 px-3 py-4 text-[12px] leading-5 text-zinc-500">
            Your personal skills will appear here. Browse skills to add one from
            Shirova.
          </p>
        )}
      </div>

      {isInstructionsDialogOpen && (
        <InstructionsDialog
          open={isInstructionsDialogOpen}
          onOpenChange={setIsInstructionsDialogOpen}
          onSave={handleSaveSkill}
        />
      )}
      {isUploadSkillDialogOpen && (
        <UploadSkillDialog
          open={isUploadSkillDialogOpen}
          onOpenChange={setIsUploadSkillDialogOpen}
        />
      )}
      {isDirectoryOpen && (
        <SkillDirectoryDialog onClose={() => setIsDirectoryOpen(false)} />
      )}
    </div>
  );
}
