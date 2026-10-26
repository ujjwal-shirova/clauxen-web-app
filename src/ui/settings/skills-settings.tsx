"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "@/components/ui/bootstrap-icon";
import { ApiError } from "@/lib/api/client";
import { listSkills } from "@/lib/api/customize";
import {
  SettingsButton,
  SettingsInlineNote,
  SettingsPage,
  SettingsSection,
  SettingsTable,
} from "@/components/settings/settings-ui";

type SkillRow = { id: string; name: string; updated: string; source: string };

export function SkillsSettings() {
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listSkills()
      .then(({ skills: saved, fileSkills }) => {
        if (cancelled) return;
        setSkills([
          ...saved.map((skill) => ({
            id: skill.id,
            name: skill.title,
            updated: skill.created_at,
            source: skill.is_default ? "Built-in" : "Custom instructions",
          })),
          ...fileSkills.map((skill) => ({
            id: skill.id,
            name: skill.name,
            updated: skill.updated_at,
            source: "Uploaded",
          })),
        ]);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof ApiError && reason.status === 401
            ? "Sign in to see and manage your skills."
            : "Couldn’t load your skills. Try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const matches = skills.filter((skill) =>
    skill.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SettingsPage>
      <SettingsSection
        title="Your skills"
        description="Reusable instructions and uploaded skills for Clauxen."
        card={false}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-[280px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--settings-fg-muted)]"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search skills"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills"
              className="settings-field settings-search-field w-full"
            />
          </label>
          <Link href="/customize/skills" className="settings-btn">
            Manage skills
          </Link>
        </div>
        {loading ? (
          <p
            role="status"
            className="py-8 text-sm text-[var(--settings-fg-muted)]"
          >
            Loading skills…
          </p>
        ) : error ? (
          <SettingsInlineNote>
            <span>{error}</span>
            <SettingsButton
              size="sm"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </SettingsButton>
          </SettingsInlineNote>
        ) : matches.length ? (
          <SettingsTable
            head={
              <tr>
                <th className="px-4 py-3 font-medium">Skill</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            }
          >
            {matches.map((skill) => (
              <tr
                key={skill.id}
                className="border-t border-[var(--settings-hairline)]"
              >
                <td className="px-4 py-3">{skill.name}</td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {new Date(skill.updated).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-[var(--settings-fg-muted)]">
                  {skill.source}
                </td>
              </tr>
            ))}
          </SettingsTable>
        ) : (
          <div role="status" className="settings-card px-6 py-10 text-center">
            <p className="text-sm">
              {query ? "No matching skills" : "No skills yet"}
            </p>
            <p className="mt-1 text-[13px] text-[var(--settings-fg-muted)]">
              {query
                ? "Try another search."
                : "Open Manage skills to browse the directory or upload your own."}
            </p>
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
