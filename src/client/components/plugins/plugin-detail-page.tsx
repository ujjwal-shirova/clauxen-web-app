"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  KeyRound,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  Trash2,
} from "@/components/ui/bootstrap-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { pluginById } from "./catalog";
import { PluginMark } from "./plugin-mark";
import { stripCursorText } from "./plugin-copy";
import { pluginDetails } from "./plugin-details";
import {
  useConnectionDetails,
  type ConnectionDetails,
  type PermissionMode,
  type PluginAvailability,
  type PluginConnection,
  type ToolRisk,
} from "./use-plugin-connections";

type Props = {
  pluginId: string;
  connection: PluginConnection | null;
  availability: PluginAvailability | null;
  connecting: boolean;
  onBack: () => void;
  onConnect: () => void;
  onDisconnect: (connection: PluginConnection) => Promise<void>;
  onChanged: () => Promise<void> | void;
};

const RISK_LABEL: Record<ToolRisk, string> = {
  read: "Read",
  write: "Write",
  destructive: "Destructive",
};

const RISK_STYLE: Record<ToolRisk, string> = {
  read: "bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300",
  write: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  destructive: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          {title}
          {count != null ? <span className="ml-1.5 font-normal text-zinc-400">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PluginDetailPage({
  pluginId,
  connection,
  availability,
  connecting,
  onBack,
  onConnect,
  onDisconnect,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const plugin = pluginById(pluginId);
  const info = pluginDetails(pluginId);
  const name = stripCursorText(info?.name ?? plugin?.name ?? connection?.pluginName ?? pluginId) || pluginId;
  const iconUrl = info?.iconUrl ?? plugin?.iconUrl ?? connection?.pluginIconUrl ?? undefined;
  const isConnected = Boolean(connection && connection.status !== "revoked");
  const { details, loading, update, sync } = useConnectionDetails(isConnected ? connection!.id : null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!plugin && !connection) {
    return (
      <div className="mx-auto w-full max-w-[860px]">
        <BackLink onBack={onBack} />
        <p className="mt-10 text-center text-[14px] text-zinc-500">This plugin could not be found.</p>
      </div>
    );
  }

  const shortDescription = stripCursorText(info?.shortDescription ?? plugin?.description ?? "");
  const overview = stripCursorText(info?.overview ?? "");

  const handleSync = async () => {
    setSyncing(true);
    try {
      await sync();
      await onChanged();
      toast({ title: "Tools refreshed", description: `${name}'s tools are up to date.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't refresh tools",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdate = async (patch: { permissionMode?: PermissionMode; tools?: Record<string, boolean> }) => {
    try {
      await update(patch);
      await onChanged();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <BackLink onBack={onBack} />

      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <PluginMark name={name} iconUrl={iconUrl} size={64} className="rounded-2xl" />
          <div className="min-w-0 pt-0.5">
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">{name}</h1>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
              {[info?.developer || plugin?.author, info?.category || plugin?.category]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {shortDescription ? (
              <p className="mt-2.5 max-w-[540px] text-[14px] leading-[22px] text-zinc-600 dark:text-zinc-300">
                {shortDescription}
              </p>
            ) : null}
          </div>
        </div>
        <ConnectActions
          name={name}
          connection={connection}
          availability={availability}
          connecting={connecting}
          syncing={syncing}
          disconnecting={disconnecting}
          onConnect={onConnect}
          onSync={handleSync}
          onDisconnect={async () => {
            if (!connection) return;
            setDisconnecting(true);
            try {
              await onDisconnect(connection);
            } finally {
              setDisconnecting(false);
            }
          }}
        />
      </header>

      {isConnected ? (
        <ConnectedSections
          details={details}
          loading={loading}
          syncing={syncing}
          onSync={handleSync}
          onUpdate={handleUpdate}
        />
      ) : null}

      {overview ? (
        <Section title="About">
          <p className="text-[14px] leading-[23px] text-zinc-600 dark:text-zinc-300">{overview}</p>
        </Section>
      ) : null}

      {info?.prompts?.length ? (
        <Section title="Try asking">
          <div className="grid gap-2 sm:grid-cols-3">
            {info.prompts.slice(0, 3).map((prompt) => (
              <a
                key={prompt}
                href={`/new?prompt=${encodeURIComponent(prompt)}`}
                className="rounded-2xl border border-black/[0.07] bg-white p-4 text-[13px] leading-5 text-zinc-700 transition-colors hover:border-black/[0.15] dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/[0.16]"
              >
                “{stripCursorText(prompt)}”
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      {info?.skills?.length ? (
        <Section title="Skills" count={info.skills.length}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {info.skills.map((skill) => (
              <li
                key={skill.name}
                className="flex gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 dark:border-white/[0.08] dark:bg-zinc-900"
              >
                <Sparkles className="mt-0.5 shrink-0 text-[14px] text-amber-500" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
                    {skill.name}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[12.5px] leading-[18px] text-zinc-500 dark:text-zinc-400">
                    {stripCursorText(skill.description)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Information">
        <dl className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-white text-[13px] dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-zinc-900">
          {(
            [
              ["Developer", info?.developer || plugin?.author],
              ["Category", info?.category || plugin?.category],
              ["Capabilities", info?.capabilities],
              ["Version", info?.version],
              [
                "Connection",
                availability?.kind === "rest"
                  ? `${availability.providerLabel ?? "Provider"} OAuth with Clauxen tools`
                  : availability?.kind === "mcp"
                    ? `${availability.providerLabel ? `${availability.providerLabel} OAuth · ` : ""}Remote MCP server`
                    : "Local only",
              ],
            ] as const
          )
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="text-right font-medium text-zinc-800 dark:text-zinc-200">{value}</dd>
              </div>
            ))}
          {info?.websiteUrl || info?.privacyUrl || info?.termsUrl ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3">
              {(
                [
                  ["Website", info?.websiteUrl],
                  ["Privacy policy", info?.privacyUrl],
                  ["Terms", info?.termsUrl],
                ] as const
              )
                .filter(([, href]) => Boolean(href))
                .map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
                  >
                    {label}
                    <ExternalLink className="text-[11px] text-zinc-400" />
                  </a>
                ))}
            </div>
          ) : null}
        </dl>
      </Section>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-8 items-center gap-2 rounded-full pl-1 pr-3 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
    >
      <ArrowLeft className="text-[13px]" />
      Plugins
    </button>
  );
}

function ConnectActions({
  name,
  connection,
  availability,
  connecting,
  syncing,
  disconnecting,
  onConnect,
  onSync,
  onDisconnect,
}: {
  name: string;
  connection: PluginConnection | null;
  availability: PluginAvailability | null;
  connecting: boolean;
  syncing: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const primary =
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

  if (connection && connection.status !== "revoked") {
    const needsReconnect = connection.status === "reauthorization_required";
    return (
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-2">
          {needsReconnect ? (
            <button type="button" onClick={onConnect} disabled={connecting} className={primary}>
              {connecting ? <Loader2 className="animate-spin text-[13px]" /> : <RotateCcw className="text-[13px]" />}
              Reconnect
            </button>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-50 px-4 text-[13px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Connected
            </span>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${name} options`}
                className="flex size-10 items-center justify-center rounded-full border border-black/[0.08] text-zinc-600 transition-colors hover:bg-black/[0.04] hover:text-zinc-900 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
              >
                <MoreHorizontal className="text-[15px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onSelect={onSync} disabled={syncing}>
                <RotateCcw className="text-[13px]" />
                Refresh tools
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onConnect}>
                <KeyRound className="text-[13px]" />
                Reauthorize
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDisconnect}
                disabled={disconnecting}
                className="text-red-600 focus:text-red-700 dark:text-red-400"
              >
                <Trash2 className="text-[13px]" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
          {needsReconnect
            ? "Access expired or was revoked at the provider."
            : connection.accountLabel
              ? `Signed in as ${connection.accountLabel}`
              : `Connected ${relativeTime(connection.connectedAt)}`}
        </p>
      </div>
    );
  }

  if (availability && !availability.available) {
    return (
      <div className="flex shrink-0 flex-col items-start gap-2 sm:max-w-[240px] sm:items-end">
        <button type="button" disabled className={cn(primary, "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-white/10 dark:text-zinc-400")}>
          {availability.reason === "local_only" ? "Local only" : "Coming soon"}
        </button>
        <p className="text-[12px] leading-[17px] text-zinc-500 sm:text-right dark:text-zinc-400">
          {availability.reason === "local_only"
            ? "This plugin only runs on a local machine, so it can't be connected to Clauxen."
            : `${availability.providerLabel ?? "This provider"} sign-in hasn't been enabled for Clauxen yet.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:max-w-[240px] sm:items-end">
      <button type="button" onClick={onConnect} disabled={connecting} className={primary}>
        {connecting ? <Loader2 className="animate-spin text-[13px]" /> : null}
        {connecting ? "Waiting for sign-in…" : `Connect ${name}`}
      </button>
      <p className="text-[12px] leading-[17px] text-zinc-500 sm:text-right dark:text-zinc-400">
        You&apos;ll approve access on {availability?.providerLabel ?? name}&apos;s own sign-in page.
      </p>
    </div>
  );
}

function ConnectedSections({
  details,
  loading,
  syncing,
  onSync,
  onUpdate,
}: {
  details: ConnectionDetails | null;
  loading: boolean;
  syncing: boolean;
  onSync: () => void;
  onUpdate: (patch: { permissionMode?: PermissionMode; tools?: Record<string, boolean> }) => void;
}) {
  if (!details) {
    return loading ? (
      <div className="mt-10 flex justify-center text-zinc-400">
        <Loader2 className="animate-spin text-[18px]" />
      </div>
    ) : null;
  }

  const mode = details.connection.permissionMode;
  const readOnly = mode === "read_only";

  return (
    <>
      <Section title="Permissions">
        <div className="rounded-2xl border border-black/[0.07] bg-white p-1.5 dark:border-white/[0.08] dark:bg-zinc-900">
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Permission mode">
            {(
              [
                ["read_only", "Read only", "Search and read. Nothing is changed."],
                ["read_write", "Read & write", "Can also create, send, and update, with your confirmation."],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => mode !== value && onUpdate({ permissionMode: value })}
                className={cn(
                  "rounded-xl px-4 py-3 text-left transition-colors",
                  mode === value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-black/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.04]",
                )}
              >
                <span className="block text-[13.5px] font-semibold">{label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[12px] leading-[17px]",
                    mode === value ? "text-white/70 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Tools"
        count={details.tools.length}
        action={
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-900 disabled:opacity-60 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
          >
            <RotateCcw className={cn("text-[12px]", syncing && "animate-spin")} />
            Refresh
          </button>
        }
      >
        {details.tools.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[0.1] px-4 py-6 text-center text-[13px] text-zinc-500 dark:border-white/10">
            No tools were discovered yet. Try Refresh.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-zinc-900">
            {details.tools.map((tool) => {
              const blockedByMode = readOnly && tool.risk !== "read";
              return (
                <li key={tool.name} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium">{tool.title}</p>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", RISK_STYLE[tool.risk])}>
                        {RISK_LABEL[tool.risk]}
                      </span>
                    </div>
                    {tool.description ? (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-[18px] text-zinc-500 dark:text-zinc-400">
                        {stripCursorText(tool.description)}
                      </p>
                    ) : null}
                    {blockedByMode ? (
                      <p className="mt-1 text-[11.5px] text-amber-700 dark:text-amber-400">
                        Unavailable while the plugin is read-only.
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={tool.enabled && !blockedByMode}
                    disabled={blockedByMode}
                    onCheckedChange={(checked) => onUpdate({ tools: { [tool.name]: checked } })}
                    aria-label={`${tool.enabled ? "Disable" : "Enable"} ${tool.title}`}
                    className="mt-0.5"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {details.resources.length > 0 ? (
        <Section title="Resources" count={details.resources.length}>
          <CapabilityList items={details.resources} />
        </Section>
      ) : null}

      {details.prompts.length > 0 ? (
        <Section title="Prompts" count={details.prompts.length}>
          <CapabilityList items={details.prompts} />
        </Section>
      ) : null}

      <Section title="Activity">
        {details.activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[0.1] px-4 py-6 text-center text-[13px] text-zinc-500 dark:border-white/10">
            No actions yet. Every tool call the assistant makes will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-zinc-900">
            {details.activity.map((call) => (
              <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    call.status === "ok" ? "bg-emerald-500" : call.status === "blocked" ? "bg-amber-500" : "bg-red-500",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12.5px] text-zinc-800 dark:text-zinc-200">{call.tool}</p>
                  {call.detail ? (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="text-[10px]" />
                      {call.detail}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[12px] text-zinc-400">
                  {call.status === "blocked" ? "Blocked · " : call.status === "error" ? "Failed · " : ""}
                  {call.durationMs != null ? `${call.durationMs} ms · ` : ""}
                  {relativeTime(call.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function CapabilityList({
  items,
}: {
  items: Array<{ name: string; title: string; description: string; uri?: string | null }>;
}) {
  return (
    <ul className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-zinc-900">
      {items.map((item) => (
        <li key={item.name} className="px-4 py-3">
          <p className="truncate text-[13.5px] font-medium">{item.title || item.name}</p>
          {item.description || item.uri ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[18px] text-zinc-500 dark:text-zinc-400">
              {item.description || item.uri}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
