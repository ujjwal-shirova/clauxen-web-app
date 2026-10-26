"use client";

import React, { useMemo } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Zap,
} from "@/components/ui/bootstrap-icon";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PluginMark } from "./plugin-mark";
import pluginDetailsDataset from "./plugin-details-dataset.json";
import { marketplaceCatalog } from "./catalog";
import type { MarketplacePlugin } from "./types";

interface PluginDetailPageProps {
  pluginId: string;
  onBack: () => void;
  connected: boolean;
  isStarting?: boolean;
  onConnect: (plugin: MarketplacePlugin) => void;
  onDisconnect?: (pluginId: string) => void;
}

interface EnrichedPluginData {
  id: string;
  name: string;
  author: string;
  shortDescription: string;
  overview: string;
  iconUrl?: string | null;
  capabilities: string;
  developer: string;
  category: string;
  version: string;
  websiteUrl: string;
  privacyUrl: string;
  termsUrl: string;
  prompts: string[];
  apps: Array<{ name: string; description: string; iconUrl?: string | null }>;
  skills: Array<{ name: string; description: string }>;
}

export function SkillCubeIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2L20.5 7L12 12L3.5 7L12 2Z" fill="#FFA726" />
      <path d="M3.5 7L12 12V22L3.5 17V7Z" fill="#FB8C00" />
      <path d="M12 12L20.5 7V17L12 22V12Z" fill="#E65100" />
    </svg>
  );
}

export function PluginDetailPage({
  pluginId,
  onBack,
  connected,
  isStarting = false,
  onConnect,
  onDisconnect,
}: PluginDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const dataset = pluginDetailsDataset as unknown as Record<string, EnrichedPluginData>;
  const catalogPlugin = marketplaceCatalog.plugins[pluginId];

  const data: EnrichedPluginData = useMemo(() => {
    if (dataset[pluginId]) {
      return dataset[pluginId];
    }
    const name = catalogPlugin?.name || pluginId;
    const desc = catalogPlugin?.description || "Connect this tool to your workspace.";
    return {
      id: pluginId,
      name,
      author: catalogPlugin?.author || "Verified Developer",
      shortDescription: desc,
      overview: desc,
      iconUrl: catalogPlugin?.iconUrl || "",
      capabilities: "Read, Write",
      developer: catalogPlugin?.author || "Verified Developer",
      category: catalogPlugin?.category || "Developer Tools",
      version: "1.0.0",
      websiteUrl: "https://clauxen.com",
      privacyUrl: "https://clauxen.com/legal/privacy",
      termsUrl: "https://clauxen.com/legal/terms",
      prompts: [
        `Use ${name} to inspect recent workspace data and summarize findings.`,
        `Connect to ${name} to automate workflows and trigger actions.`,
        `Review best practices and security policies with ${name}.`,
      ],
      apps: [{ name, description: desc }],
      skills: [
        {
          name: `${pluginId}-skill`,
          description: `Use when performing tasks involving ${name}. Automates API calls and data operations.`,
        },
      ],
    };
  }, [catalogPlugin, dataset, pluginId]);

  const handlePromptClick = (promptText: string) => {
    router.push(`/new?prompt=${encodeURIComponent(promptText)}`);
  };

  const handleTryInChat = () => {
    router.push(`/new?prompt=${encodeURIComponent(`@${data.name} `)}`);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Plugin link copied to clipboard.",
      });
    }
  };

  const currentPluginObj: MarketplacePlugin = {
    id: data.id,
    name: data.name,
    description: data.shortDescription,
    author: data.developer,
    iconUrl: data.iconUrl || "",
    category: data.category,
    installed: connected,
  };

  return (
    <div className="plugin-detail-page mx-auto w-full max-w-[820px] px-5 sm:px-8 py-5 text-neutral-900 dark:text-neutral-100 font-sans select-none animate-in fade-in duration-200">
      {/* Top Breadcrumb Nav */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 pb-6">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          Plugins
        </button>
        <ChevronRight className="size-3.5 text-neutral-400" />
        <span className="font-medium text-neutral-800 dark:text-neutral-200">
          {data.name}
        </span>
      </nav>

      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="size-14 rounded-2xl flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-xs overflow-hidden">
            <PluginMark name={data.name} iconUrl={data.iconUrl || undefined} size={40} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
              {data.name}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
              By {data.author} • {data.shortDescription}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {/* Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More options"
                className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors outline-none"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1 shadow-lg text-xs"
            >
              <DropdownMenuItem
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Share2 className="size-3.5" />
                <span>Copy Link</span>
              </DropdownMenuItem>
              {data.websiteUrl ? (
                <DropdownMenuItem
                  onClick={() => window.open(data.websiteUrl, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Developer Website</span>
                </DropdownMenuItem>
              ) : null}
              {connected && onDisconnect ? (
                <DropdownMenuItem
                  onClick={() => onDisconnect(data.id)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer font-medium text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" />
                  <span>Disconnect</span>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Manage / Connect Button */}
          {connected ? (
            <button
              type="button"
              onClick={() => onDisconnect ? onDisconnect(data.id) : null}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-xs transition-colors"
            >
              <Settings className="size-3" />
              <span>Manage</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onConnect(currentPluginObj)}
              disabled={isStarting}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-xs transition-colors disabled:opacity-50"
            >
              {isStarting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Zap className="size-3 text-emerald-500" />
              )}
              <span>Connect</span>
            </button>
          )}

          {/* Try in Chat Button */}
          <button
            type="button"
            onClick={handleTryInChat}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 px-4 py-1.5 text-xs font-semibold shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            <MessageSquare className="size-3" />
            <span>Try in chat</span>
          </button>
        </div>
      </div>

      {/* Banner / Hero Placeholder with Gradient Background */}
      <div className="relative w-full rounded-2xl overflow-hidden p-5 sm:p-7 bg-gradient-to-tr from-blue-100/70 via-purple-100/50 to-indigo-100/70 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border border-neutral-200/50 dark:border-neutral-800/60 shadow-xs">
        <div className="space-y-2.5 max-w-2xl mx-auto">
          {data.prompts.map((promptText, idx) => (
            <div
              key={idx}
              onClick={() => handlePromptClick(promptText)}
              className="w-full rounded-xl sm:rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-white/80 dark:border-neutral-800/80 px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md hover:scale-[1.008] active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs shrink-0">
                  <span className="text-[11px]">✦</span> {data.name}
                </span>
                <span className="text-xs sm:text-[13px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors truncate">
                  {promptText}
                </span>
              </div>
              <div className="size-6 sm:size-7 rounded-full bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 text-neutral-500 dark:text-neutral-400 flex items-center justify-center shrink-0 transition-colors shadow-xs">
                <ArrowRight className="size-3 sm:size-3.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overview Paragraph */}
      <div className="pt-6">
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
          {data.overview}
        </p>
      </div>

      {/* Apps Section */}
      <div className="pt-8">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Apps <span className="text-neutral-400 text-sm font-normal">{data.apps.length}</span>
        </h2>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800/80">
          {data.apps.map((app, idx) => (
            <div key={idx} className="flex items-center gap-3.5 py-3.5">
              <div className="size-9 rounded-lg flex items-center justify-center shrink-0 border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1.5 shadow-xs overflow-hidden">
                <PluginMark name={app.name} iconUrl={app.iconUrl || data.iconUrl || undefined} size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {app.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {app.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills Section */}
      {data.skills && data.skills.length > 0 ? (
        <div className="pt-8">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Skills <span className="text-neutral-400 text-sm font-normal">{data.skills.length}</span>
          </h2>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800/80">
            {data.skills.map((skill, idx) => (
              <div key={idx} className="flex items-start gap-3.5 py-3.5">
                <div className="mt-0.5">
                  <SkillCubeIcon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold font-mono text-neutral-900 dark:text-neutral-100 truncate">
                    {skill.name}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-0.5">
                    {skill.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Information Section */}
      <div className="pt-8">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Information
        </h2>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800/80 text-xs sm:text-sm">
          <div className="flex items-baseline justify-between py-3">
            <span className="text-neutral-500">Capabilities</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {data.capabilities}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-3">
            <span className="text-neutral-500">Developer</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {data.developer}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-3">
            <span className="text-neutral-500">Category</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {data.category}
            </span>
          </div>

          <div className="flex items-baseline justify-between py-3">
            <span className="text-neutral-500">Version</span>
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {data.version}
            </span>
          </div>

          {data.websiteUrl ? (
            <div className="flex items-baseline justify-between py-3">
              <span className="text-neutral-500">Website</span>
              <a
                href={data.websiteUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
              >
                <span>{data.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                <ExternalLink className="size-3 text-neutral-400" />
              </a>
            </div>
          ) : null}

          {data.privacyUrl ? (
            <div className="flex items-baseline justify-between py-3">
              <span className="text-neutral-500">Privacy Policy</span>
              <a
                href={data.privacyUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
              >
                <span>Privacy</span>
                <ExternalLink className="size-3 text-neutral-400" />
              </a>
            </div>
          ) : null}

          {data.termsUrl ? (
            <div className="flex items-baseline justify-between py-3">
              <span className="text-neutral-500">Terms of Service</span>
              <a
                href={data.termsUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
              >
                <span>Terms</span>
                <ExternalLink className="size-3 text-neutral-400" />
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer Legal / Policy Note */}
      <div className="pt-8 pb-12">
        <p className="text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500 border-t border-neutral-100 dark:border-neutral-800/80 pt-4">
          When connected to {data.name}, Clauxen may share relevant chats and context with this app to help fulfill your requests. {data.name}’s use of this data is subject to their{" "}
          <a
            href={data.termsUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            terms
          </a>{" "}
          and{" "}
          <a
            href={data.privacyUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            privacy policy
          </a>
          . Clauxen always respects your training data preferences. Use of external apps may involve permissions to read or write data. You can manage your preferences or disconnect anytime.
        </p>
      </div>
    </div>
  );
}
