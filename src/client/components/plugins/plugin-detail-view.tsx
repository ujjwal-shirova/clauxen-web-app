"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  LoaderCircle,
  MessageSquare,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import type { PluginCatalogItem, PluginSummary } from "@/lib/plugins/types";
import { pluginRouteSegment } from "@/lib/plugins/types";
import { usePluginInstallations } from "./use-plugin-installations";

function safeAccent(value: string | undefined): string {
  if (!value) return "#64748b";
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#64748b";
}

function safeExternalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function categoryLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PluginHeroLogo({
  plugin,
  size = 64,
}: {
  plugin: PluginCatalogItem;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  const accent = safeAccent(plugin.brandColor);

  useEffect(() => setImageFailed(false), [plugin.logoUrl]);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[var(--ui-border)] text-2xl font-bold text-white shadow-md"
      style={{
        width: size,
        height: size,
        backgroundColor:
          plugin.logoUrl && !imageFailed
            ? "var(--app-panel-bg)"
            : accent,
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
        <span className="drop-shadow-sm">{initial}</span>
      )}
    </div>
  );
}

function PluginMiniCard({ plugin }: { plugin: PluginSummary }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  const accent = safeAccent(plugin.brandColor);

  return (
    <Link
      href={`/plugins/${pluginRouteSegment(plugin)}`}
      prefetch
      className="group flex flex-col justify-between rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--ui-border)] hover:shadow-xs"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--ui-border-subtle)] text-[12px] font-semibold text-white"
          style={{
            backgroundColor:
              plugin.logoUrl && !imageFailed
                ? "var(--app-panel-bg)"
                : accent,
          }}
        >
          {plugin.logoUrl && !imageFailed ? (
            <Image
              src={plugin.logoUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[13px] font-semibold text-[var(--ui-fg)] group-hover:text-black dark:group-hover:text-white">
            {plugin.displayName || plugin.name}
          </h4>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-[var(--ui-fg-muted)]">
            {plugin.shortDescription || plugin.description || "Integrate with Clauxen"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[var(--ui-fg-muted)]">
        <span>View details</span>
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function PluginDetailView({
  plugin,
  relatedPlugins = [],
  returnCategory = null,
}: {
  plugin: PluginCatalogItem;
  relatedPlugins?: PluginSummary[];
  returnCategory?: string | null;
}) {
  const installations = usePluginInstallations();
  const installed = installations.isInstalled(plugin.id);
  const pending = installations.isPending(plugin.id);
  const busy = installations.pendingId === plugin.id;
  const isSaved = installations.isInCollection(plugin.id);

  const [copiedMention, setCopiedMention] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const prompts = useMemo(
    () => (plugin.defaultPrompts || []).filter(Boolean).slice(0, 3),
    [plugin.defaultPrompts],
  );

  const categorySlug =
    plugin.categories.find((c) => c !== "featured" && c !== "new-and-noteworthy") ??
    plugin.categories[0] ??
    "tool";
  const primaryCategory = categoryLabel(categorySlug);

  const description =
    plugin.longDescription ||
    plugin.description ||
    plugin.shortDescription ||
    plugin.directoryDescription ||
    `The ${plugin.displayName} plugin gives Clauxen direct access to its tools and resources.`;

  const backHref = "/plugins";

  const chatMention = `@${plugin.displayName || plugin.name}`;
  const defaultChatHref = `/new?prompt=${encodeURIComponent(`${chatMention} `)}`;

  const accentStyle = {
    "--plugin-accent": safeAccent(plugin.brandColor),
  } as CSSProperties;

  const toggleInstallation = () => {
    if (installed) {
      void installations.remove(plugin.id);
    } else {
      void installations.install(plugin.id, {
        category: returnCategory,
        returnPath: `/plugins/${pluginRouteSegment(plugin)}`,
      });
    }
  };

  const handleCopyMention = async () => {
    try {
      await navigator.clipboard.writeText(chatMention);
      setCopiedMention(true);
      setTimeout(() => setCopiedMention(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const externalLinks = [
    { label: "Website", href: safeExternalUrl(plugin.websiteUrl), icon: Globe },
    { label: "MCP Protocol", href: safeExternalUrl(plugin.mcpUrl), icon: Terminal },
    { label: "Privacy Policy", href: safeExternalUrl(plugin.privacyPolicyUrl), icon: ShieldCheck },
    { label: "Terms of Service", href: safeExternalUrl(plugin.termsOfServiceUrl), icon: Info },
  ].filter((item): item is { label: string; href: string; icon: typeof Globe } => Boolean(item.href));

  return (
    <div
      className={cn(appPage.surface, "bg-[var(--app-panel-bg)]")}
      style={accentStyle}
    >
      <div className="app-scrollbar flex-1 overflow-y-auto">
        {/* Sticky Header Nav */}
        <header className="sticky top-0 z-30 border-b border-[var(--ui-border-subtle)] bg-[color-mix(in_oklab,var(--app-panel-bg)_94%,transparent)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-2">
              <Link
                href={backHref}
                prefetch
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)]"
              >
                <ArrowLeft className="size-3.5" />
                <span>All Plugins</span>
              </Link>
              <span className="text-[var(--ui-fg-placeholder)]">/</span>
              <span className="hidden sm:inline text-[12.5px] font-medium text-[var(--ui-fg-muted)]">
                {primaryCategory}
              </span>
              <span className="hidden sm:inline text-[var(--ui-fg-placeholder)]">/</span>
              <span className="truncate text-[12.5px] font-semibold text-[var(--ui-fg)] max-w-[180px] sm:max-w-[260px]">
                {plugin.displayName || plugin.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyMention}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-2.5 text-[12px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--app-frame-bg)]"
                title="Copy mention tag for chat"
              >
                {copiedMention ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5 text-[var(--ui-fg-muted)]" />
                )}
                <span>{copiedMention ? "Copied @mention" : chatMention}</span>
              </button>

              <button
                type="button"
                onClick={() => installations.toggleCollection(plugin.id)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border transition-colors",
                  isSaved
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] text-[var(--ui-fg-muted)] hover:bg-[var(--app-frame-bg)] hover:text-[var(--ui-fg)]",
                )}
                title={isSaved ? "Saved in your collection" : "Add to collection"}
                aria-label={isSaved ? "Saved in your collection" : "Add to collection"}
              >
                {isSaved ? (
                  <BookmarkCheck className="size-4 fill-current" />
                ) : (
                  <Bookmark className="size-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex size-8 items-center justify-center rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--app-frame-bg)] hover:text-[var(--ui-fg)]"
                title="Share plugin link"
                aria-label="Share plugin link"
              >
                {copiedLink ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Share2 className="size-4" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-6 sm:px-8">
          {/* Hero Card */}
          <section className="relative overflow-hidden rounded-[24px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-6 sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-80 rounded-full opacity-60 blur-3xl"
              style={{
                backgroundColor: "var(--plugin-accent)",
              }}
            />

            <div className="relative flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                <div className="flex items-start gap-4">
                  <PluginHeroLogo plugin={plugin} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[color-mix(in_oklab,var(--ui-fg)_6%,transparent)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[var(--ui-fg-muted)]">
                        {primaryCategory}
                      </span>
                      {plugin.version ? (
                        <span className="rounded-md border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--ui-fg-muted)]">
                          v{plugin.version}
                        </span>
                      ) : null}
                      {plugin.developer ? (
                        <span className="text-[12px] text-[var(--ui-fg-muted)]">
                          by <strong className="font-medium text-[var(--ui-fg)]">{plugin.developer}</strong>
                        </span>
                      ) : null}
                    </div>

                    <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ui-fg)]">
                      {plugin.displayName || plugin.name}
                    </h1>

                    <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--ui-fg-muted)]">
                      {plugin.shortDescription || plugin.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[var(--ui-border-subtle)]">
                {/* Connect / Add Button */}
                <button
                  type="button"
                  onClick={toggleInstallation}
                  disabled={busy}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-field-focus-border)] disabled:cursor-wait disabled:opacity-60 shadow-xs",
                    installed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-[var(--ui-fg)] bg-[var(--ui-fg)] text-[var(--app-panel-bg)] hover:opacity-90",
                  )}
                >
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : installed ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    <Plus className="size-4" strokeWidth={2} />
                  )}
                  <span>
                    {busy
                      ? "Connecting..."
                      : installed
                        ? "Added to Clauxen"
                        : pending
                          ? "Sign in to Connect"
                          : "Add to Clauxen"}
                  </span>
                </button>

                {/* Open in Chat Button */}
                <Link
                  href={defaultChatHref}
                  prefetch
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-4 text-[13px] font-semibold text-[var(--ui-fg)] shadow-xs transition-colors hover:bg-[var(--ui-hover-wash)]"
                >
                  <MessageSquare className="size-4" />
                  <span>Open in Chat</span>
                  <ArrowRight className="size-3.5 opacity-60" />
                </Link>

                {/* Add to Collection Bookmark Button */}
                <button
                  type="button"
                  onClick={() => installations.toggleCollection(plugin.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-medium transition-colors",
                    isSaved
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-[var(--ui-border)] bg-[var(--app-panel-bg)] text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)] hover:bg-[var(--app-frame-bg)]",
                  )}
                >
                  {isSaved ? (
                    <BookmarkCheck className="size-4 fill-current" />
                  ) : (
                    <Bookmark className="size-4" />
                  )}
                  <span>{isSaved ? "Saved to Collection" : "Add to Collection"}</span>
                </button>

                {/* Website Link */}
                {plugin.websiteUrl && safeExternalUrl(plugin.websiteUrl) ? (
                  <a
                    href={safeExternalUrl(plugin.websiteUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] px-3 text-[12.5px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)]"
                  >
                    <span>Website</span>
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              {installations.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                  {installations.error}
                </div>
              ) : null}
            </div>
          </section>

          {/* Starter Prompts Section */}
          {prompts.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <h2 className="text-[15px] font-semibold text-[var(--ui-fg)]">
                  Starter Prompts
                </h2>
                <span className="text-[12px] text-[var(--ui-fg-muted)]">
                  — click any prompt to start chatting
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {prompts.map((prompt, index) => {
                  const promptHref = `/new?prompt=${encodeURIComponent(`${chatMention} ${prompt}`)}`;
                  return (
                    <Link
                      key={prompt}
                      href={promptHref}
                      prefetch
                      className="group flex min-h-[110px] flex-col justify-between rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--ui-border)] hover:bg-[var(--app-panel-bg)] hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-md bg-[var(--ui-hover-wash)] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[var(--plugin-accent)]">
                          0{index + 1}
                        </span>
                        <ArrowRight className="size-3.5 text-[var(--ui-fg-placeholder)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--ui-fg)]" />
                      </div>
                      <p className="mt-3 line-clamp-3 text-[13px] font-medium leading-snug text-[var(--ui-fg)]">
                        &ldquo;{prompt}&rdquo;
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* 2-Column Detail Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            {/* Left Column (Main Info) */}
            <div className="flex flex-col gap-6">
              {/* About Article */}
              <article className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-5 sm:p-6">
                <h2 className="text-[16px] font-semibold text-[var(--ui-fg)]">
                  About {plugin.displayName || plugin.name}
                </h2>
                <div className="mt-3 text-[13.5px] leading-relaxed text-[var(--ui-fg-muted)] space-y-3 whitespace-pre-wrap">
                  {description}
                </div>

                {/* Capabilities Badges */}
                {plugin.capabilities && plugin.capabilities.length > 0 ? (
                  <div className="mt-5 border-t border-[var(--ui-border-subtle)] pt-4">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ui-fg-placeholder)]">
                      Supported Capabilities
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {plugin.capabilities.map((cap) => (
                        <div
                          key={cap}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--ui-fg)]"
                        >
                          <Zap className="size-3 text-amber-500" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Keyword Pills */}
                {plugin.keywords && plugin.keywords.length > 0 ? (
                  <div className="mt-5 border-t border-[var(--ui-border-subtle)] pt-4">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ui-fg-placeholder)]">
                      Related Topics
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {plugin.keywords.slice(0, 16).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md bg-[var(--ui-hover-wash)] px-2 py-0.5 text-[11px] text-[var(--ui-fg-muted)]"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>

              {/* How to Use Guide */}
              <section className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-[var(--ui-fg-muted)]" />
                  <h2 className="text-[15px] font-semibold text-[var(--ui-fg)]">
                    How to use in Clauxen
                  </h2>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-3.5">
                    <span className="text-[11px] font-mono font-semibold text-[var(--ui-fg-muted)]">
                      STEP 1
                    </span>
                    <h4 className="mt-1 text-[13px] font-semibold text-[var(--ui-fg)]">
                      Mention the Tool
                    </h4>
                    <p className="mt-1 text-[12px] text-[var(--ui-fg-muted)]">
                      Type <code className="rounded bg-[var(--ui-hover-wash)] px-1 text-[11px] font-mono">{chatMention}</code> in any chat to invoke it.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-3.5">
                    <span className="text-[11px] font-mono font-semibold text-[var(--ui-fg-muted)]">
                      STEP 2
                    </span>
                    <h4 className="mt-1 text-[13px] font-semibold text-[var(--ui-fg)]">
                      State Your Task
                    </h4>
                    <p className="mt-1 text-[12px] text-[var(--ui-fg-muted)]">
                      Ask questions, query live data, or request automated actions.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-3.5">
                    <span className="text-[11px] font-mono font-semibold text-[var(--ui-fg-muted)]">
                      STEP 3
                    </span>
                    <h4 className="mt-1 text-[13px] font-semibold text-[var(--ui-fg)]">
                      Inspect Results
                    </h4>
                    <p className="mt-1 text-[12px] text-[var(--ui-fg-muted)]">
                      Clauxen securely executes tool functions and formats responses.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column (Sidebar Cards) */}
            <aside className="flex flex-col gap-4">
              {/* Technical Specifications */}
              <div className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-4 sm:p-5">
                <div className="flex items-center gap-2 pb-3 border-b border-[var(--ui-border-subtle)] text-[13px] font-semibold text-[var(--ui-fg)]">
                  <Wrench className="size-3.5 text-[var(--ui-fg-muted)]" />
                  <span>Technical Details</span>
                </div>

                <dl className="mt-3 divide-y divide-[var(--ui-border-subtle)] text-[12.5px]">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-[var(--ui-fg-placeholder)]">Category</dt>
                    <dd className="font-medium text-[var(--ui-fg)]">{primaryCategory}</dd>
                  </div>
                  {plugin.developer ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-[var(--ui-fg-placeholder)]">Developer</dt>
                      <dd className="font-medium text-[var(--ui-fg)] truncate max-w-[150px]">
                        {plugin.developer}
                      </dd>
                    </div>
                  ) : null}
                  {plugin.version ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-[var(--ui-fg-placeholder)]">Version</dt>
                      <dd className="font-mono text-[var(--ui-fg)]">{plugin.version}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-[var(--ui-fg-placeholder)]">Protocol</dt>
                    <dd className="font-medium text-[var(--ui-fg)]">Model Context Protocol</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-[var(--ui-fg-placeholder)]">Connector</dt>
                    <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                      Cloudflare Verified
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Links & Resources */}
              {externalLinks.length > 0 ? (
                <div className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-4 sm:p-5">
                  <h3 className="text-[13px] font-semibold text-[var(--ui-fg)] pb-2 border-b border-[var(--ui-border-subtle)]">
                    Links & Documentation
                  </h3>
                  <div className="mt-2 flex flex-col divide-y divide-[var(--ui-border-subtle)]">
                    {externalLinks.map(({ label, href, icon: Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-2 text-[12.5px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:text-[var(--ui-fg)]"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="size-3.5 text-[var(--ui-fg-placeholder)]" />
                          <span>{label}</span>
                        </div>
                        <ExternalLink className="size-3 text-[var(--ui-fg-placeholder)]" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Security & Data Notes */}
              <div className="rounded-[20px] border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)] p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-[13px] font-semibold text-[var(--ui-fg)]">
                    Privacy & Sandboxing
                  </h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--ui-fg-muted)]">
                  MCP tools operate in isolated Cloudflare sandboxes. Clauxen only shares explicit query parameters requested by you during conversation.
                </p>
              </div>
            </aside>
          </div>

          {/* Related Plugins Section */}
          {relatedPlugins && relatedPlugins.length > 0 ? (
            <section className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--ui-fg)]">
                    Related Tools & Plugins
                  </h2>
                  <p className="text-[12px] text-[var(--ui-fg-muted)]">
                    More plugins in {primaryCategory} and related workflows.
                  </p>
                </div>
                <Link
                  href="/plugins"
                  className="text-[12px] font-medium text-[var(--ui-fg-muted)] hover:text-[var(--ui-fg)]"
                >
                  Browse all →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPlugins.map((item) => (
                  <PluginMiniCard key={item.id} plugin={item} />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
