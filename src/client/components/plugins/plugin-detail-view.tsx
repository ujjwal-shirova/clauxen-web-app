"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import {
  INITIAL_INSTALLED_PLUGINS,
  pluginIconPath,
  type PluginDetail,
} from "./plugin-directory-data";

const STORAGE_KEY = "clauxen_installed_directory_plugins_v1";

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

function readInstalledPlugins() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const names = JSON.parse(saved) as unknown;
      if (Array.isArray(names)) {
        return new Set(names.filter((item) => typeof item === "string"));
      }
    }
  } catch {
    // Use the built-in set when storage is unavailable.
  }
  return new Set<string>(INITIAL_INSTALLED_PLUGINS);
}

export function PluginDetailView({
  plugin,
  returnCategory,
}: {
  plugin: PluginDetail;
  returnCategory?: string | null;
}) {
  const [installed, setInstalled] = useState(() =>
    new Set<string>(INITIAL_INSTALLED_PLUGINS).has(plugin.name),
  );

  useEffect(() => {
    setInstalled(readInstalledPlugins().has(plugin.name));
  }, [plugin.name]);

  const toggleInstallation = () => {
    const names = readInstalledPlugins();
    if (names.has(plugin.name)) names.delete(plugin.name);
    else names.add(plugin.name);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...names]));
    } catch {
      // Keep the detail interaction available in restricted contexts.
    }
    setInstalled(names.has(plugin.name));
  };

  const backHref = returnCategory
    ? `/plugins?category=${encodeURIComponent(returnCategory)}`
    : "/plugins";

  return (
    <div className={appPage.surface}>
      <div className="app-scrollbar flex-1 overflow-y-auto">
        <nav className="sticky top-0 z-20 flex bg-[rgba(252,252,252,0.88)] px-4 pb-2 pt-2.5 backdrop-blur-xl">
          <Link
            href={backHref}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-black/[0.04]"
          >
            <ChevronLeft className="size-5" strokeWidth={1.7} />
            Plugins
          </Link>
        </nav>

        <main className="mobile-page-inset mx-auto w-full max-w-[896px] px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
          <section className="flex flex-col gap-7">
            <div className="relative flex size-[68px] items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <Image
                src={pluginIconPath(plugin.name)}
                alt={`${plugin.name} icon`}
                width={68}
                height={68}
                unoptimized
                className="size-full object-cover"
                priority
              />
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[32px] font-semibold leading-10 tracking-[-0.03em] text-zinc-950">
                  {plugin.name}
                </h1>
                <p className="mt-1.5 text-[16px] leading-6 text-zinc-600">
                  {plugin.description}
                </p>
              </div>

              {installed ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleInstallation}
                    aria-label={`Remove ${plugin.name}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 text-[14px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                  >
                    <Check className="size-4" strokeWidth={1.8} />
                    Installed
                  </button>
                  <Link
                    href="/new"
                    className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    Try in chat
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={toggleInstallation}
                  className="h-10 shrink-0 rounded-full bg-zinc-900 px-5 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Install plugin
                </button>
              )}
            </div>
          </section>

          <section
            aria-label={`Try ${plugin.name}`}
            className="mt-10 flex min-h-[390px] items-center rounded-[22px] px-5 py-12 sm:min-h-[450px] sm:px-12"
            style={{
              background:
                CATEGORY_GRADIENTS[plugin.categorySlug] ??
                CATEGORY_GRADIENTS.other,
            }}
          >
            <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
              {plugin.prompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/new?prompt=${encodeURIComponent(prompt)}`}
                  className="group flex min-h-[68px] items-center gap-4 rounded-[28px] border border-white/65 bg-white/80 px-5 py-3 text-left text-[15px] leading-6 text-zinc-800 shadow-[0_8px_28px_rgba(45,75,100,0.12)] backdrop-blur-md transition-all hover:bg-white/95 hover:shadow-[0_10px_34px_rgba(45,75,100,0.17)] sm:px-6 sm:text-[16px]"
                >
                  <span className="min-w-0 flex-1">{prompt}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-700 shadow-sm transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="size-5" strokeWidth={1.6} />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <p className="text-[15px] leading-7 text-zinc-600">
              {plugin.overview}
            </p>
          </section>

          <section className="mt-12 border-t border-black/[0.08] pt-9">
            <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  {plugin.apps.length === 1 ? "App" : "Apps"}
                </h2>
                <div className="mt-4 flex flex-col gap-3">
                  {plugin.apps.map((app) => (
                    <div key={app} className="flex items-center gap-3">
                      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-black/10 bg-white">
                        <Image
                          src={pluginIconPath(plugin.name)}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="size-full object-cover"
                        />
                      </span>
                      <span className="text-[14px] font-medium text-zinc-900">
                        {app}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  Information
                </h2>
                <dl className="mt-4 divide-y divide-black/[0.06]">
                  {[
                    ["Capabilities", plugin.capabilities],
                    ["Developer", plugin.developer],
                    ["Category", plugin.category],
                    ["Version", plugin.version],
                  ].map(([label, value]) => (
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

          <section className="mt-10 border-t border-black/[0.08] pt-8">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-zinc-700">
              <Link href="/legal/privacy" className="hover:text-zinc-950">
                Privacy Policy
              </Link>
              <Link href="/legal/terms" className="hover:text-zinc-950">
                Terms of Service
              </Link>
            </div>
            <p className="mt-6 text-[12px] leading-5 text-zinc-500">
              When connected to {plugin.name}, Clauxen may share relevant chat
              context with this plugin to help complete your requests. A
              plugin&apos;s use of data is subject to its own terms and privacy
              policy. You can remove a plugin at any time from this page or
              manage connected tools in settings.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
