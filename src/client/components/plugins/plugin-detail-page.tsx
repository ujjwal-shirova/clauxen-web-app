"use client";

import { ArrowLeft, ExternalLink, Sparkles } from "@/components/ui/bootstrap-icon";
import { pluginById } from "./catalog";
import { PluginMark } from "./plugin-mark";
import { stripCursorText } from "./plugin-copy";
import { pluginDetails } from "./plugin-details";

type Props = {
  pluginId: string;
  onBack: () => void;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          {title}
          {count != null ? <span className="ml-1.5 font-normal text-zinc-400">{count}</span> : null}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function PluginDetailPage({ pluginId, onBack }: Props) {
  const plugin = pluginById(pluginId);
  const info = pluginDetails(pluginId);
  const name = stripCursorText(info?.name ?? plugin?.name ?? pluginId) || pluginId;
  const iconUrl = info?.iconUrl ?? plugin?.iconUrl ?? undefined;

  if (!plugin && !info) {
    return (
      <div className="mx-auto w-full max-w-[860px]">
        <BackLink onBack={onBack} />
        <p className="mt-10 text-center text-[14px] text-zinc-500">This plugin could not be found.</p>
      </div>
    );
  }

  const shortDescription = stripCursorText(info?.shortDescription ?? plugin?.description ?? "");
  const overview = stripCursorText(info?.overview ?? "");

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
      </header>

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
