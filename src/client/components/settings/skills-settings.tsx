"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Search } from "lucide-react";
import {
  SettingsButton,
  SettingsPanelTitle,
  SettingsTable,
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

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
          aria-label="Search skills"
        >
          <Search className="size-4" />
        </button>
        <SettingsButton size="sm" onClick={() => setDirectoryOpen(true)}>
          Browse
        </SettingsButton>
        <SettingsButton size="sm" onClick={() => setUploadOpen(true)}>
          Add
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </SettingsButton>
      </div>

      <SettingsTable
        head={
          <tr>
            <th className="px-4 py-2.5 font-medium">Skill</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
            <th className="px-4 py-2.5 font-medium">Author</th>
          </tr>
        }
      >
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
      </SettingsTable>

      {directoryOpen ? (
        <SkillDirectoryDialog onClose={() => setDirectoryOpen(false)} />
      ) : null}
      <UploadSkillDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
