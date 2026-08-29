"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Search } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
} from "@/components/settings/settings-ui";

const SkillDirectoryDialog = dynamic(
  () =>
    import("@/components/customize/skills/directory").then(
      (mod) => mod.SkillDirectoryDialog,
    ),
  { ssr: false },
);

const UploadSkillDialog = dynamic(
  () =>
    import("@/components/customize/skills/upload-dialog").then(
      (mod) => mod.UploadSkillDialog,
    ),
  { ssr: false },
);

const DEMO_SKILLS = [
  { name: "skill-creator", updated: "7/10/26", author: "Clauxen" },
];

export function SkillsSettings() {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Skills</SettingsPanelTitle>

      <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)]"
            aria-label="Search skills"
          >
            <Search className="size-5" />
          </button>
          <SettingsPillButton onClick={() => setDirectoryOpen(true)}>
            Browse
          </SettingsPillButton>
          <SettingsPillButton onClick={() => setUploadOpen(true)}>
            Add
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </SettingsPillButton>
        </div>
      </div>

      <div className="settings-card overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[var(--settings-sidebar-bg)] text-[var(--settings-fg-muted)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Skill</th>
              <th className="px-4 py-2.5 font-medium">Last updated</th>
              <th className="px-4 py-2.5 font-medium">Author</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SKILLS.map((skill) => (
              <tr
                key={skill.name}
                className="border-t border-[var(--settings-hairline)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--settings-fg)]">
                  {skill.name}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {skill.updated}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {skill.author}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {directoryOpen ? (
        <SkillDirectoryDialog onClose={() => setDirectoryOpen(false)} />
      ) : null}
      <UploadSkillDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
