"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plus,
  Share2,
} from "lucide-react";
import { chrome } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";
import type { PluginCatalogItem, PluginSummary } from "@/connectors/catalog/types";
import { pluginRouteSegment } from "@/connectors/catalog/types";
import { usePluginInstallations } from "./use-plugin-installations";
import { PluginArtwork } from "./plugin-artwork";
import { PluginPageHeader } from "./plugin-page-header";
import { PluginApiKeyDialog } from "./plugin-api-key-dialog";

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

function PluginMiniCard({ plugin }: { plugin: PluginSummary }) {
  const name = plugin.displayName || plugin.name;
  return (
    <Link
      href={`/connectors/${pluginRouteSegment(plugin)}`}
      prefetch={false}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--settings-hairline)] bg-[var(--settings-card-bg)] px-3 py-2.5 hover:bg-[var(--ui-hover-wash)]"
    >
      <PluginArtwork
        name={name}
        logoUrl={plugin.logoUrl}
        brandColor={plugin.brandColor}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[13.5px] font-medium text-[var(--settings-fg)]">
          {name}
        </h4>
        <p className="line-clamp-1 text-[12px] text-[var(--settings-fg-muted)]">
          {plugin.shortDescription || plugin.description || "Connector"}
        </p>
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
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const prompts = useMemo(
    () => (plugin.defaultPrompts || []).filter(Boolean).slice(0, 3),
    [plugin.defaultPrompts],
  );

  const categorySlug =
    plugin.categories.find(
      (item) => item !== "featured" && item !== "new-and-noteworthy",
    ) ??
    plugin.categories[0] ??
    "tool";
  const primaryCategory = categoryLabel(categorySlug);
  const name = plugin.displayName || plugin.name;

  const description =
    plugin.longDescription ||
    plugin.description ||
    plugin.shortDescription ||
    plugin.directoryDescription ||
    `${name} gives Clauxen access to its tools.`;

  const chatMention = `@${name}`;
  const defaultChatHref = `/new?prompt=${encodeURIComponent(`${chatMention} `)}`;

  const toggleInstallation = () => {
    if (installed) {
      void installations.remove(plugin.id);
      return;
    }
    void installations
      .install(plugin.id, {
        category: returnCategory,
        returnPath: `/connectors/${pluginRouteSegment(plugin)}`,
      })
      .then((result) => {
        if (!result.ok && result.code === "plugin_api_key_required") {
          setKeyError(null);
          setKeyDialogOpen(true);
        }
      });
  };

  const submitApiKey = (apiKey: string) => {
    void installations
      .install(plugin.id, {
        category: returnCategory,
        returnPath: `/connectors/${pluginRouteSegment(plugin)}`,
        apiKey,
      })
      .then((result) => {
        if (result.ok) {
          setKeyDialogOpen(false);
          setKeyError(null);
        } else {
          setKeyError(result.message || "That key didn't work. Try again.");
        }
      });
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
    { label: "Website", href: safeExternalUrl(plugin.websiteUrl) },
    {
      label: "Docs",
      href: safeExternalUrl(plugin.documentationUrl || plugin.sourceUrl),
    },
    { label: "MCP", href: safeExternalUrl(plugin.mcpUrl) },
    { label: "Privacy", href: safeExternalUrl(plugin.privacyPolicyUrl) },
    { label: "Terms", href: safeExternalUrl(plugin.termsOfServiceUrl) },
  ].filter(
    (item): item is { label: string; href: string } => Boolean(item.href),
  );

  const addLabel = busy
    ? "Working"
    : installed
      ? "Added"
      : pending
        ? "Sign in"
        : "Add to Clauxen";
  const isRest = plugin.kind === "rest";
  const protocolLabel = isRest ? "REST" : "MCP";
  const tools = (plugin.tools || []).filter(
    (tool) => tool.title || tool.name,
  );

  return (
    <div className={chrome.page.surface}>
      <PluginPageHeader
        title={name}
        backHref="/connectors"
        backLabel="All connectors"
        trailing={
          <>
            <button
              type="button"
              onClick={() => installations.toggleCollection(plugin.id)}
              className="ui-icon-button text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
              title={isSaved ? "Saved" : "Save"}
              aria-label={isSaved ? "Remove from saved" : "Save connector"}
            >
              {isSaved ? (
                <BookmarkCheck className="size-[18px]" strokeWidth={1.75} />
              ) : (
                <Bookmark className="size-[18px]" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="ui-icon-button hidden text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)] sm:inline-flex"
              title="Copy link"
              aria-label="Copy link"
            >
              {copiedLink ? (
                <Check className="size-[18px]" strokeWidth={1.75} />
              ) : (
                <Share2 className="size-[18px]" strokeWidth={1.75} />
              )}
            </button>
          </>
        }
      />

      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-3 pb-28 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <PluginArtwork
              name={name}
              logoUrl={plugin.logoUrl}
              brandColor={plugin.brandColor}
              size={56}
              className="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-[var(--settings-fg-muted)]">
                {primaryCategory}
                {plugin.developer ? ` · ${plugin.developer}` : ""}
                {plugin.version ? ` · v${plugin.version}` : ""}
              </p>
              <h2 className="mt-0.5 text-[20px] font-medium tracking-[-0.03em] text-[var(--settings-fg)] sm:text-[22px]">
                {name}
              </h2>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-5 text-[var(--settings-fg-muted)]">
                {plugin.shortDescription || plugin.description}
              </p>

              <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={toggleInstallation}
                  disabled={busy}
                  className={cn(
                    "no-hover connector-add-btn inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium disabled:opacity-60",
                    installed && "connector-add-btn--added",
                  )}
                >
                  {busy ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : installed ? (
                    <Check className="size-3.5" strokeWidth={2} />
                  ) : (
                    <Plus className="size-3.5" strokeWidth={2} />
                  )}
                  {addLabel}
                </button>
                <Link
                  href={defaultChatHref}
                  prefetch
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--settings-input-border)] px-3.5 text-[13px] font-medium text-[var(--settings-fg)] hover:bg-[var(--ui-hover-wash)]"
                >
                  Open in chat
                </Link>
                <button
                  type="button"
                  onClick={handleCopyMention}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-[var(--settings-fg-muted)] hover:bg-[var(--ui-hover-wash)] hover:text-[var(--settings-fg)]"
                >
                  {copiedMention ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedMention ? "Copied" : chatMention}
                </button>
              </div>
            </div>
          </section>

          {installations.error && !keyDialogOpen ? (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {installations.error}
            </p>
          ) : null}

          {prompts.length > 0 ? (
            <section>
              <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                Try in chat
              </h3>
              <ul className="mt-2 divide-y divide-[var(--settings-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--settings-hairline)] bg-[var(--settings-card-bg)]">
                {prompts.map((prompt) => {
                  const promptHref = `/new?prompt=${encodeURIComponent(`${chatMention} ${prompt}`)}`;
                  return (
                    <li key={prompt}>
                      <Link
                        href={promptHref}
                        prefetch
                        className="block px-3.5 py-3 text-[13.5px] leading-5 text-[var(--settings-fg)] hover:bg-[var(--ui-hover-wash)]"
                      >
                        {prompt}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
              About
            </h3>
            <div className="mt-2 whitespace-pre-wrap text-[13.5px] leading-6 text-[var(--settings-fg-muted)]">
              {description}
            </div>

            {plugin.capabilities && plugin.capabilities.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {plugin.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-md bg-[var(--ui-hover-wash)] px-2 py-0.5 text-[12px] text-[var(--settings-fg-muted)]"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {tools.length > 0 ? (
            <section>
              <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                Tools
              </h3>
              <ul className="mt-2 divide-y divide-[var(--settings-hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--settings-hairline)] bg-[var(--settings-card-bg)]">
                {tools.map((tool) => (
                  <li key={tool.name} className="px-3.5 py-3">
                    <p className="text-[13.5px] font-medium text-[var(--settings-fg)]">
                      {tool.title || tool.name}
                    </p>
                    {tool.description ? (
                      <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--settings-fg-muted)]">
                        {tool.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plugin.scopes && plugin.scopes.length > 0 ? (
            <section>
              <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                Permissions
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plugin.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="rounded-md bg-[var(--ui-hover-wash)] px-2 py-0.5 font-mono text-[11.5px] text-[var(--settings-fg-muted)]"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
              How to use
            </h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-5 text-[var(--settings-fg-muted)]">
              {isRest ? (
                <>
                  <li>
                    Click Add to Clauxen. If the app can sign in with OAuth,
                    you’ll be sent to the provider. Otherwise paste an access
                    token.
                  </li>
                  <li>
                    After it shows Added, Clauxen can use this app’s tools in
                    chat.
                  </li>
                  <li>
                    Then type{" "}
                    <button
                      type="button"
                      onClick={handleCopyMention}
                      className="rounded bg-[var(--ui-hover-wash)] px-1 py-0.5 font-mono text-[12px] text-[var(--settings-fg)]"
                    >
                      {copiedMention ? "Copied" : chatMention}
                    </button>{" "}
                    in a chat to use its tools.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Add the connector, then type{" "}
                    <button
                      type="button"
                      onClick={handleCopyMention}
                      className="rounded bg-[var(--ui-hover-wash)] px-1 py-0.5 font-mono text-[12px] text-[var(--settings-fg)]"
                    >
                      {copiedMention ? "Copied" : chatMention}
                    </button>{" "}
                    in a chat.
                  </li>
                  <li>Ask it to look something up or take an action.</li>
                  <li>
                    Clauxen runs the tool and shows the result in the thread.
                  </li>
                </>
              )}
            </ol>
          </section>

          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                Details
              </h3>
              <dl className="mt-2 space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--settings-fg-muted)]">Category</dt>
                  <dd className="text-[var(--settings-fg)]">
                    {primaryCategory}
                  </dd>
                </div>
                {plugin.developer ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--settings-fg-muted)]">
                      Developer
                    </dt>
                    <dd className="truncate text-[var(--settings-fg)]">
                      {plugin.developer}
                    </dd>
                  </div>
                ) : null}
                {plugin.version ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--settings-fg-muted)]">Version</dt>
                    <dd className="text-[var(--settings-fg)]">
                      {plugin.version}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--settings-fg-muted)]">Protocol</dt>
                  <dd className="text-[var(--settings-fg)]">
                    {protocolLabel}
                  </dd>
                </div>
              </dl>
            </div>

            {externalLinks.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                  Links
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {externalLinks.map(({ label, href }) => (
                    <li key={label}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                      >
                        {label}
                        <ExternalLink className="size-3" strokeWidth={1.75} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {relatedPlugins.length > 0 ? (
            <section>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-medium text-[var(--settings-fg)]">
                  Related
                </h3>
                <Link
                  href="/connectors"
                  className="text-[12.5px] text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                >
                  All connectors
                </Link>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {relatedPlugins.map((item) => (
                  <PluginMiniCard key={item.id} plugin={item} />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleInstallation}
            disabled={busy}
            className={cn(
              "no-hover connector-add-btn inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-medium disabled:opacity-60",
              installed && "connector-add-btn--added",
            )}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : installed ? (
              <Check className="size-4" strokeWidth={2} />
            ) : (
              <Plus className="size-4" strokeWidth={2} />
            )}
            {addLabel}
          </button>
          <Link
            href={defaultChatHref}
            prefetch
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg border border-[var(--settings-input-border)] text-[13.5px] font-medium text-[var(--settings-fg)]"
          >
            Open in chat
          </Link>
        </div>
      </div>

      <PluginApiKeyDialog
        open={keyDialogOpen}
        pluginName={name}
        pending={busy}
        error={keyError}
        onSubmit={submitApiKey}
        onClose={() => {
          setKeyDialogOpen(false);
          setKeyError(null);
        }}
      />
    </div>
  );
}
