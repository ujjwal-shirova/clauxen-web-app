"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ExternalLink,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import type { PluginCatalogItem } from "@/lib/plugins/types";

const STORAGE_KEY = "clauxen_installed_directory_plugin_ids_v2";

function readInstalled() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(saved)
        ? saved.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function safeAccent(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#64748b";
}

function PluginLogo({
  plugin,
  size = 52,
}: {
  plugin: PluginCatalogItem;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();

  useEffect(() => setImageFailed(false), [plugin.logoUrl]);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--ui-border)] text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(20,21,26,0.06)]"
      style={{
        width: size,
        height: size,
        backgroundColor:
          plugin.logoUrl && !imageFailed
            ? "var(--app-panel-bg)"
            : safeAccent(plugin.brandColor),
      }}
    >
      {plugin.logoUrl && !imageFailed ? (
        <Image
          src={plugin.logoUrl}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function categoryLabel(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PluginDetailView({
  plugin,
  returnCategory,
}: {
  plugin: PluginCatalogItem;
  returnCategory?: string | null;
}) {
  const [installed, setInstalled] = useState(false);
  useEffect(() => setInstalled(readInstalled().has(plugin.id)), [plugin.id]);

  const prompts = useMemo(
    () => plugin.defaultPrompts.filter(Boolean).slice(0, 3),
    [plugin.defaultPrompts],
  );
  const categorySlug =
    plugin.categories.find((category) => category !== "featured") ??
    plugin.categories[0] ??
    "other";
  const primaryCategory = categoryLabel(categorySlug);
  const description =
    plugin.longDescription ||
    plugin.description ||
    plugin.shortDescription ||
    plugin.directoryDescription;
  const backHref = returnCategory
    ? `/plugins?category=${encodeURIComponent(returnCategory)}`
    : "/plugins";
  const externalLinks = [
    ["Website", safeExternalUrl(plugin.websiteUrl)],
    ["Privacy", safeExternalUrl(plugin.privacyPolicyUrl)],
    ["Terms", safeExternalUrl(plugin.termsOfServiceUrl)],
  ].flatMap(([label, href]) => (href ? [{ label, href }] : []));
  const informationRows: Array<[string, string]> = [
    ["Category", primaryCategory],
    ["Developer", plugin.developer],
    ["Version", plugin.version],
    ["Capabilities", plugin.capabilities.join(", ")],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const accentStyle = {
    "--plugin-accent": safeAccent(plugin.brandColor),
  } as CSSProperties;

  const toggleInstallation = () => {
    const next = readInstalled();
    if (next.has(plugin.id)) next.delete(plugin.id);
    else next.add(plugin.id);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Keep the current-session state when storage is unavailable.
    }
    setInstalled(next.has(plugin.id));
  };

  return (
    <div
      className={cn(appPage.surface, "bg-[var(--app-panel-bg)]")}
      style={accentStyle}
    >
      <div className="app-scrollbar flex-1 overflow-y-auto bg-[var(--app-panel-bg)]">
        <nav className="sticky top-0 z-20 border-b border-[var(--ui-border-subtle)] bg-[color-mix(in_oklab,var(--app-panel-bg)_94%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center justify-between px-4 sm:px-7">
            <Link
              href={backHref}
              prefetch
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]"
            >
              <ChevronLeft className="size-4" strokeWidth={1.8} />
              Plugin gallery
            </Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ui-fg-placeholder)]">
              Tool profile
            </span>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-5 sm:px-7 sm:pt-7">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_292px]">
            <div className="relative overflow-hidden rounded-[24px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-5 sm:p-6">
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-[var(--plugin-accent)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--plugin-accent) 12%, transparent), transparent 48%)",
                }}
              />
              <div className="relative">
                <div className="flex min-w-0 items-start gap-4">
                  <PluginLogo plugin={plugin} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--ui-fg-placeholder)]">
                      {primaryCategory}
                    </p>
                    <h1 className="mt-0.5 truncate text-[24px] font-semibold leading-8 tracking-[-0.025em] text-[var(--ui-fg)]">
                      {plugin.displayName}
                    </h1>
                  </div>
                </div>
                <p className="mt-4 max-w-[660px] text-[13.5px] leading-5 text-[var(--ui-fg-muted)]">
                  {plugin.shortDescription ||
                    plugin.description ||
                    "Use this plugin with Clauxen."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleInstallation}
                    aria-pressed={installed}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)]",
                      installed
                        ? "border-[var(--ui-border)] bg-[var(--app-panel-bg)] text-[var(--ui-fg)]"
                        : "border-[var(--ui-fg)] bg-[var(--ui-fg)] text-[var(--app-panel-bg)] hover:opacity-90",
                    )}
                  >
                    {installed ? (
                      <Check className="size-3.5" strokeWidth={2.2} />
                    ) : (
                      <Plus className="size-3.5" strokeWidth={2} />
                    )}
                    {installed ? "Added to Clauxen" : "Add to Clauxen"}
                  </button>
                  <Link
                    href={`/new?prompt=${encodeURIComponent(`@${plugin.displayName} `)}`}
                    prefetch
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-3.5 text-[12.5px] font-semibold text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]"
                  >
                    Open in chat <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <aside className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ui-fg)]">
                <Wrench className="size-3.5 text-[var(--ui-fg-muted)]" />
                At a glance
              </div>
              <dl className="mt-3 divide-y divide-[var(--ui-border-subtle)]">
                {informationRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[88px_1fr] gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <dt className="text-[11.5px] text-[var(--ui-fg-placeholder)]">
                      {label}
                    </dt>
                    <dd className="min-w-0 text-right text-[11.5px] font-medium leading-4 text-[var(--ui-fg-muted)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </section>

          {prompts.length > 0 ? (
            <section className="mt-5" aria-labelledby="plugin-starters-title">
              <div className="mb-2.5">
                <h2
                  id="plugin-starters-title"
                  className="text-[14px] font-semibold text-[var(--ui-fg)]"
                >
                  Starter routes
                </h2>
                <p className="mt-0.5 text-[11.5px] text-[var(--ui-fg-placeholder)]">
                  Begin with a focused request, then refine it in chat.
                </p>
              </div>
              <div className="grid gap-2.5 md:grid-cols-3">
                {prompts.map((prompt, index) => (
                  <Link
                    key={prompt}
                    href={`/new?prompt=${encodeURIComponent(`@${plugin.displayName} ${prompt}`)}`}
                    prefetch
                    className="group flex min-h-[118px] flex-col justify-between rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4 transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-[var(--ui-border)] hover:shadow-[0_10px_28px_-22px_rgba(20,21,26,0.35)]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[10.5px] font-semibold tabular-nums text-[var(--plugin-accent)]">
                        0{index + 1}
                      </span>
                      <ArrowRight className="size-3.5 text-[var(--ui-fg-placeholder)] transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-4 line-clamp-3 text-[12.5px] font-medium leading-[18px] text-[var(--ui-fg)]">
                      {prompt}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_292px]">
            <article className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-4 sm:p-5">
              <h2 className="text-[14px] font-semibold text-[var(--ui-fg)]">
                About this tool
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[21px] text-[var(--ui-fg-muted)]">
                {description ||
                  `${plugin.displayName} can be used from a Clauxen conversation.`}
              </p>
              {plugin.keywords.length > 0 ? (
                <div
                  className="mt-4 flex flex-wrap gap-1.5"
                  aria-label="Plugin topics"
                >
                  {plugin.keywords.slice(0, 10).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-md bg-[var(--ui-hover-wash)] px-2 py-1 text-[10.5px] text-[var(--ui-fg-muted)]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>

            <aside className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[var(--ui-fg-muted)]" />
                <h2 className="text-[13px] font-semibold text-[var(--ui-fg)]">
                  Connection notes
                </h2>
              </div>
              <p className="mt-2 text-[11.5px] leading-[17px] text-[var(--ui-fg-muted)]">
                Clauxen may share relevant chat context with this tool when you
                use it. The provider&apos;s terms govern its data use.
              </p>
              {externalLinks.length > 0 ? (
                <div className="mt-3 flex flex-col border-t border-[var(--ui-border-subtle)] pt-2">
                  {externalLinks.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-8 items-center justify-between gap-3 rounded-lg px-1.5 text-[11.5px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                    >
                      {label}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
