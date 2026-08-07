"use client";

import {
  FolderKanban,
  Image as ImageIcon,
  Images,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioMode, StudioSection } from "./studio-types";

type StudioLeftRailProps = {
  mode: StudioMode;
  section: StudioSection;
  onModeChange: (mode: StudioMode) => void;
  onSectionChange: (section: StudioSection) => void;
};

const SECTIONS: {
  id: StudioSection;
  label: string;
  icon: typeof Sparkles;
}[] = [
  { id: "create", label: "Create", icon: Sparkles },
  { id: "assets", label: "Assets", icon: Images },
  { id: "projects", label: "Projects", icon: FolderKanban },
];

export function StudioLeftRail({
  mode,
  section,
  onModeChange,
  onSectionChange,
}: StudioLeftRailProps) {
  return (
    <aside className="studio-left-rail flex w-[56px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0e0d0b] md:w-[200px]">
      <div className="flex flex-col gap-0.5 p-2 md:p-2.5">
        <p className="studio-rail-label mb-1.5 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 md:block">
          Mode
        </p>
        <button
          type="button"
          title="Image"
          onClick={() => {
            onModeChange("image");
            onSectionChange("create");
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium transition-colors md:justify-start md:px-2.5",
            mode === "image" && section === "create"
              ? "bg-white/[0.08] text-[#f2ebe0]"
              : "text-white/55 hover:bg-white/[0.04] hover:text-white/80",
          )}
        >
          <ImageIcon className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden md:inline">Image</span>
        </button>
        <button
          type="button"
          title="Video"
          onClick={() => {
            onModeChange("video");
            onSectionChange("create");
          }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium transition-colors md:justify-start md:px-2.5",
            mode === "video" && section === "create"
              ? "bg-white/[0.08] text-[#f2ebe0]"
              : "text-white/55 hover:bg-white/[0.04] hover:text-white/80",
          )}
        >
          <Video className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden md:inline">Video</span>
        </button>
      </div>

      <div className="mx-2 h-px bg-white/[0.06] md:mx-3" />

      <nav className="flex flex-col gap-0.5 p-2 md:p-2.5">
        <p className="studio-rail-label mb-1.5 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 md:block">
          Workspace
        </p>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-medium transition-colors md:justify-start md:px-2.5",
              section === id
                ? "bg-white/[0.08] text-[#f2ebe0]"
                : "text-white/55 hover:bg-white/[0.04] hover:text-white/80",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.5} />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
