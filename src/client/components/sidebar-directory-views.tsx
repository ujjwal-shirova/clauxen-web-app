"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api/client";

export { ProjectsView } from "@/components/projects/projects-view";

type SkillRow = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
};

function DirectoryShell({
  title,
  subtitle,
  loading,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6 py-8">
      <h1 className="text-[22px] font-medium tracking-[-0.03em] text-[var(--ui-fg)]">
        {title}
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ui-fg-muted)]">{subtitle}</p>
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="chat-search-skeleton flex h-12 items-center rounded-xl px-3"
            >
              <span className="h-3.5 w-2/5 rounded-md" />
            </div>
          ))
        ) : (
          children ?? (
            <p className="px-1 py-8 text-[13px] text-[var(--ui-fg-muted)]">
              {empty}
            </p>
          )
        )}
      </div>
    </div>
  );
}

export function PluginsView() {
  const [rows, setRows] = useState<SkillRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ skills: SkillRow[]; fileSkills?: SkillRow[] }>(
      "/api/v1/customize/skills",
    )
      .then((result) => {
        if (cancelled) return;
        const text = result.skills ?? [];
        const files = (result.fileSkills ?? []).map((skill) => ({
          id: skill.id,
          title: skill.name || skill.title,
          description: skill.description,
        }));
        setRows([...text, ...files]);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DirectoryShell
      title="Plugins"
      subtitle="Skills and tools available in your chats."
      loading={rows === null}
      empty="No plugins yet."
    >
      {rows && rows.length
        ? rows.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--ui-hover-wash)]"
            >
              <p className="truncate text-[14px] font-medium text-[var(--ui-fg)]">
                {skill.title || skill.name || "Untitled"}
              </p>
              {skill.description ? (
                <p className="line-clamp-2 text-[13px] text-[var(--ui-fg-muted)]">
                  {skill.description}
                </p>
              ) : null}
            </div>
          ))
        : null}
    </DirectoryShell>
  );
}
