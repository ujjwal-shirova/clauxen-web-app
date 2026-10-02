"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Plug,
  Sparkles,
  Terminal,
  Webhook,
  Wrench,
} from "lucide-react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useAppLayout } from "@/components/app-layout-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import type { PluginInfoData, McpServerSummary } from "@/lib/mcp-plugin-dataset";
import { stripCursorText } from "./plugin-copy";
import { PluginMark } from "./plugin-mark";
import { McpToolsSection } from "./mcp-tools-section";

const INSTALLS_KEY = "clauxen.marketplace.installs";

function readInstalls(): string[] {
  try {
    const raw = localStorage.getItem(INSTALLS_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

type SectionRow = {
  icon: typeof Sparkles;
  name: string;
  description: string;
  href?: string | null;
};

function SectionCard({ rows }: { rows: SectionRow[] }) {
  const VISIBLE = 5;
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, rows.length - VISIBLE);
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
      <div className="divide-y divide-[var(--ui-border-subtle)]">
        {visibleRows.map((row, index) => {
          const Icon = row.icon;
          const body = (
            <>
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
                <Icon className="size-[15px]" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--ui-fg)]">
                  {row.name}
                </span>
                {row.description ? (
                  <span className="mt-0.5 block overflow-hidden text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {row.description}
                  </span>
                ) : null}
              </span>
              {row.href ? (
                <ArrowUpRight
                  className="size-3.5 shrink-0 text-[var(--ui-fg-placeholder)]"
                  strokeWidth={1.5}
                />
              ) : null}
            </>
          );

          return row.href ? (
            <a
              key={`${row.name}-${index}`}
              href={row.href}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--ui-hover-wash)]"
            >
              {body}
            </a>
          ) : (
            <div
              key={`${row.name}-${index}`}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              {body}
            </div>
          );
        })}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-center gap-1 border-t border-[var(--ui-border-subtle)] px-3 py-2 text-[12.5px] font-medium leading-[18px] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-ring)]"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
            strokeWidth={1.75}
          />
        </button>
      ) : null}
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ui-fg-muted)]">
        {label}
        {typeof count === "number" ? (
          <span className="text-[var(--ui-fg-placeholder)]">· {count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

export function PluginInfoPage({
  slug,
  plugin,
}: {
  slug: string;
  plugin: PluginInfoData;
}) {
  const isMobile = useIsMobile();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const [installed, setInstalled] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInstalled(readInstalls());
    setHydrated(true);
  }, []);

  const isInstalled = installed.includes(slug);

  const toggleInstalled = () => {
    setInstalled((current) => {
      const next = current.includes(slug)
        ? current.filter((id) => id !== slug)
        : [...current, slug];
      localStorage.setItem(INSTALLS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const name =
    stripCursorText(plugin.displayName || plugin.name) || plugin.name || slug;
  const description = stripCursorText(plugin.description);
  const publisher = plugin.publisher;
  const publisherName = publisher
    ? stripCursorText(publisher.displayName || publisher.name) || undefined
    : undefined;
  const repositoryUrl = plugin.repositoryUrl;

  const httpServers = useMemo(
    (): McpServerSummary[] =>
      plugin.mcpServers.filter((server) => server.type === "http" && server.url),
    [plugin.mcpServers],
  );

  const mcpRows = useMemo<SectionRow[]>(
    () =>
      plugin.mcpServers.map((server) => ({
        icon: Plug,
        name: server.name,
        description:
          server.type === "http"
            ? (server.url ?? "")
            : [server.command, ...(server.args ?? [])]
                .filter(Boolean)
                .join(" ") || "Local stdio server",
        href: server.url,
      })),
    [plugin.mcpServers],
  );

  const skillRows = useMemo<SectionRow[]>(
    () =>
      plugin.skills.map((skill) => ({
        icon: Sparkles,
        name: skill.name,
        description: skill.description,
      })),
    [plugin.skills],
  );

  const commandRows = useMemo<SectionRow[]>(
    () =>
      plugin.commands.map((command) => ({
        icon: Terminal,
        name: command.name,
        description: command.description,
        href: command.sourceUrl,
      })),
    [plugin.commands],
  );

  const hookRows = useMemo<SectionRow[]>(
    () =>
      plugin.hooks.map((hook) => ({
        icon: Webhook,
        name: hook.name,
        description: hook.description,
        href: hook.sourceUrl,
      })),
    [plugin.hooks],
  );

  const ruleRows = useMemo<SectionRow[]>(
    () =>
      plugin.rules.map((rule) => ({
        icon: BookOpen,
        name: rule.name,
        description: rule.description,
        href: rule.sourceUrl,
      })),
    [plugin.rules],
  );

  const subagentRows = useMemo<SectionRow[]>(
    () =>
      plugin.subagents.map((subagent) => ({
        icon: Bot,
        name: subagent.name,
        description: subagent.description,
      })),
    [plugin.subagents],
  );

  const totalRows =
    mcpRows.length +
    skillRows.length +
    commandRows.length +
    hookRows.length +
    ruleRows.length +
    subagentRows.length;

  return (
    <div className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans">
      {isMobile ? (
        <MobilePageHeader
          title={name}
          onOpenMobileNav={openMobileNav}
          isNavOpen={!isSidebarCollapsed}
        />
      ) : null}

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[780px] px-4 pb-16 sm:px-6">
          {/* Breadcrumb — back to the main marketplace list */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 pt-5 text-[12.5px] leading-[18px]"
          >
            <Link
              href="/plugins"
              className="text-[var(--ui-fg-muted)] transition-colors hover:text-[var(--ui-fg)]"
            >
              Plugins
            </Link>
            <ChevronRight
              className="size-3 text-[var(--ui-fg-placeholder)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="truncate text-[var(--ui-fg)]">{name}</span>
          </nav>

          {/* Header */}
          <header className="pt-6">
            <div className="flex items-start gap-4">
              <PluginMark
                name={name}
                iconUrl={plugin.logoUrl ?? undefined}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-[19px] font-semibold leading-6 tracking-[-0.01em] text-[var(--ui-fg)]">
                  {name}
                </h1>
                {description ? (
                  <p className="mt-1.5 text-[13px] leading-5 text-[var(--ui-fg-body)]">
                    {description}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
                  {publisherName ? (
                    <span className="inline-flex items-center gap-1">
                      {publisherName}
                      {publisher?.isVerified ? (
                        <Check
                          className="size-3 text-[var(--success)]"
                          strokeWidth={2.25}
                          aria-label="Verified publisher"
                        />
                      ) : null}
                    </span>
                  ) : null}
                  {repositoryUrl ? (
                    <a
                      href={repositoryUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 transition-colors hover:text-[var(--ui-fg)]"
                    >
                      Repository
                      <ArrowUpRight className="size-3" strokeWidth={1.75} />
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Actions — the visibility dropdown is intentionally excluded */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-pressed={isInstalled}
                  onClick={toggleInstalled}
                  className={cn(
                    appBtn.secondarySm,
                    "no-hover-overlay h-8 min-w-[88px] px-3",
                    isInstalled && hydrated && "text-[var(--ui-fg-muted)]",
                  )}
                >
                  {isInstalled && hydrated ? "Uninstall" : "Add"}
                </button>
                <Link
                  href="/new"
                  className={cn(appBtn.primarySm, "no-hover-overlay h-8 px-3")}
                >
                  Try in Chat
                </Link>
              </div>
            </div>
          </header>

          {/* Capability sections — rendered from the scraped dataset */}
          <div className="mt-8 flex flex-col gap-7">
            {mcpRows.length > 0 ? (
              <Section label="MCPs" count={mcpRows.length}>
                <SectionCard rows={mcpRows} />
              </Section>
            ) : null}

            <McpToolsSection servers={httpServers} />

            {skillRows.length > 0 ? (
              <Section label="Skills" count={skillRows.length}>
                <SectionCard rows={skillRows} />
              </Section>
            ) : null}

            {commandRows.length > 0 ? (
              <Section label="Commands" count={commandRows.length}>
                <SectionCard rows={commandRows} />
              </Section>
            ) : null}

            {hookRows.length > 0 ? (
              <Section label="Hooks" count={hookRows.length}>
                <SectionCard rows={hookRows} />
              </Section>
            ) : null}

            {ruleRows.length > 0 ? (
              <Section label="Rules" count={ruleRows.length}>
                <SectionCard rows={ruleRows} />
              </Section>
            ) : null}

            {subagentRows.length > 0 ? (
              <Section label="Subagents" count={subagentRows.length}>
                <SectionCard rows={subagentRows} />
              </Section>
            ) : null}

            {totalRows === 0 ? (
              <p className="rounded-xl border border-[var(--ui-border)] bg-white px-3 py-6 text-center text-[12.5px] text-[var(--ui-fg-muted)]">
                This plugin doesn&apos;t publish skills, commands, hooks, or MCP
                servers.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PluginInfoNotFound({ slug }: { slug: string }) {
  return (
    <div className="plugin-marketplace flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 bg-[var(--app-panel-bg)] px-6 text-center font-sans">
      <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
        <Wrench className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div>
        <h1 className="text-[14px] font-medium leading-5 text-[var(--ui-fg)]">
          Plugin not found
        </h1>
        <p className="mt-0.5 text-[12.5px] leading-[18px] text-[var(--ui-fg-muted)]">
          No details are available for “{slug}” in the plugin catalog yet.
        </p>
      </div>
      <Link href="/plugins" className={cn(appBtn.secondarySm, "px-2.5")}>
        Back to Plugins
      </Link>
    </div>
  );
}
