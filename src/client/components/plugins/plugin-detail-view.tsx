"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ExternalLink,
  Plus,
} from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import type { PluginCatalogItem } from "@/lib/plugins/types";

const STORAGE_KEY = "clauxen_installed_directory_plugin_ids_v2";

const CATEGORY_GRADIENTS: Record<string, string> = {
  featured: "linear-gradient(135deg, #c9e9ff 0%, #76c8eb 52%, #86d0aa 100%)",
  productivity:
    "linear-gradient(135deg, #e6dcff 0%, #bbb9f5 50%, #8bcfd2 100%)",
  creativity: "linear-gradient(135deg, #ffd8e7 0%, #d9b8f3 48%, #8ccfec 100%)",
  "developer-tools":
    "linear-gradient(135deg, #d5e4ff 0%, #9ab9ef 48%, #8193cf 100%)",
  "business-and-operations":
    "linear-gradient(135deg, #ffe4b8 0%, #eec77d 48%, #8fd2ad 100%)",
  "data-and-analytics":
    "linear-gradient(135deg, #c9edf1 0%, #83cad0 50%, #80a9db 100%)",
  communication:
    "linear-gradient(135deg, #c6e8ff 0%, #72c3e8 52%, #80c9a6 100%)",
  "education-and-research":
    "linear-gradient(135deg, #f4e0b9 0%, #dac594 48%, #9abfc9 100%)",
  "scientific-research":
    "linear-gradient(135deg, #d7e7ff 0%, #a9c6e8 48%, #91cfbd 100%)",
  security: "linear-gradient(135deg, #d5ddeb 0%, #9facbf 52%, #7ea49d 100%)",
  finance: "linear-gradient(135deg, #d8efce 0%, #a2d3a7 48%, #78b7b0 100%)",
  healthcare: "linear-gradient(135deg, #d5f0ea 0%, #9bd6c9 48%, #9fbde7 100%)",
  travel: "linear-gradient(135deg, #d4ebff 0%, #87c9ef 48%, #89d5c0 100%)",
  entertainment:
    "linear-gradient(135deg, #f4d4ff 0%, #c6a7ed 48%, #84bde8 100%)",
  other: "linear-gradient(135deg, #ebe3d7 0%, #c8b9a4 48%, #9cb9b0 100%)",
};

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

function PluginLogo({
  plugin,
  size = 68,
}: {
  plugin: PluginCatalogItem;
  size?: number;
}) {
  const initial = (plugin.displayName || plugin.name || "P")
    .slice(0, 1)
    .toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white text-xl font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      style={{
        width: size,
        height: size,
        backgroundColor: plugin.logoUrl
          ? "white"
          : plugin.brandColor || "#8c8c8c",
      }}
    >
      {plugin.logoUrl ? (
        <img
          src={plugin.logoUrl}
          alt={`${plugin.displayName} logo`}
          className="size-full object-cover"
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
    ["Privacy policy", safeExternalUrl(plugin.privacyPolicyUrl)],
    ["Terms of service", safeExternalUrl(plugin.termsOfServiceUrl)],
  ].flatMap(([label, href]) => (href ? [{ label, href }] : []));

  const toggleInstallation = () => {
    const next = readInstalled();
    if (next.has(plugin.id)) next.delete(plugin.id);
    else next.add(plugin.id);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* in-memory state remains available */
    }
    setInstalled(next.has(plugin.id));
  };

  return (
    <div className={appPage.surface}>
      <div className="app-scrollbar flex-1 overflow-y-auto">
        <nav className="sticky top-0 z-20 flex bg-[rgba(252,252,252,0.88)] px-4 pb-2 pt-2.5 backdrop-blur-xl">
          <Link
            href={backHref}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-black/[0.04]"
          >
            <ChevronLeft className="size-5" strokeWidth={1.7} /> Plugins
          </Link>
        </nav>
        <main className="mobile-page-inset mx-auto w-full max-w-[896px] px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
          <section className="flex flex-col gap-7">
            <PluginLogo plugin={plugin} />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[32px] font-semibold leading-10 tracking-[-0.03em] text-zinc-950">
                  {plugin.displayName}
                </h1>
                <p className="mt-1.5 text-[16px] leading-6 text-zinc-600">
                  {plugin.shortDescription ||
                    plugin.description ||
                    "Use this plugin with Clauxen."}
                </p>
              </div>
              {installed ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleInstallation}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                  >
                    <Check className="size-4" strokeWidth={1.8} /> Installed
                  </button>
                  <Link
                    href={`/new?prompt=${encodeURIComponent(`@${plugin.displayName} `)}`}
                    className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    Try in chat
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={toggleInstallation}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  <Plus className="size-4" /> Install plugin
                </button>
              )}
            </div>
          </section>
          {prompts.length > 0 ? (
            <section
              aria-label={`Try ${plugin.displayName}`}
              className="mt-10 flex min-h-[390px] items-center rounded-[22px] px-5 py-12 sm:min-h-[450px] sm:px-12"
              style={{
                background:
                  CATEGORY_GRADIENTS[categorySlug] ?? CATEGORY_GRADIENTS.other,
              }}
            >
              <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
                {prompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href={`/new?prompt=${encodeURIComponent(`@${plugin.displayName} ${prompt}`)}`}
                    className="group flex min-h-[68px] items-center gap-4 rounded-[28px] border border-white/65 bg-white/80 px-5 py-3 text-left text-[15px] leading-6 text-zinc-800 shadow-[0_8px_28px_rgba(45,75,100,0.12)] backdrop-blur-md transition-all hover:bg-white/95 hover:shadow-[0_10px_34px_rgba(45,75,100,0.17)] sm:px-6 sm:text-[16px]"
                  >
                    <span className="min-w-0 flex-1">
                      <strong>@{plugin.displayName} </strong>
                      {prompt}
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-5" strokeWidth={1.6} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {description ? (
            <section className="mt-10">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-zinc-900">
                About {plugin.displayName}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-zinc-600">
                {description}
              </p>
            </section>
          ) : null}
          <section className="mt-12 border-t border-black/[0.08] pt-9">
            <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  App
                </h2>
                <div className="mt-4 flex items-center gap-3">
                  <PluginLogo plugin={plugin} size={36} />
                  <div>
                    <p className="text-[14px] font-medium text-zinc-900">
                      {plugin.displayName}
                    </p>
                    {plugin.developer ? (
                      <p className="text-[13px] text-zinc-500">
                        by {plugin.developer}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  Information
                </h2>
                <dl className="mt-4 divide-y divide-black/[0.06]">
                  {[
                    ["Capabilities", plugin.capabilities.join(", ")],
                    ["Developer", plugin.developer],
                    ["Category", primaryCategory],
                    ["Version", plugin.version],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-6 py-3 first:pt-0"
                      >
                        <dt className="text-[13px] text-zinc-500">{label}</dt>
                        <dd className="text-right text-[13px] font-medium text-zinc-800">
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
          </section>
          {externalLinks.length > 0 || plugin.keywords.length > 0 ? (
            <section className="mt-10 border-t border-black/[0.08] pt-8">
              {externalLinks.length > 0 ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-zinc-700">
                  {externalLinks.map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-zinc-950"
                    >
                      {label}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              ) : null}
              {plugin.keywords.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {plugin.keywords.slice(0, 12).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-black/[0.08] bg-black/[0.025] px-2.5 py-1 text-xs text-zinc-600"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
          <p className="mt-8 text-[12px] leading-5 text-zinc-500">
            When connected to {plugin.displayName}, Clauxen may share relevant
            chat context with this plugin to help complete your requests. A
            plugin&apos;s use of data is subject to its own terms and privacy
            policy. You can remove a plugin at any time from this page.
          </p>
        </main>
      </div>
    </div>
  );
}
