"use client";

import { cn } from "@/lib/utils";
import { PluginCard } from "./plugin-card";
import type { MarketplacePlugin } from "./types";

type CategorySectionProps = {
  title: string;
  plugins: MarketplacePlugin[];
  installed: Set<string>;
  onOpen: (plugin: MarketplacePlugin) => void;
  onToggle: (id: string) => void;
  className?: string;
};

export function CategorySection({
  title,
  plugins,
  installed,
  onOpen,
  onToggle,
  className,
}: CategorySectionProps) {
  if (!plugins.length) return null;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <section className={cn("mt-8", className)} aria-labelledby={`plugin-section-${slug}`}>
      <h2
        id={`plugin-section-${slug}`}
        className="mb-3 text-[15px] font-medium leading-5 tracking-[-0.01em] text-[var(--ui-fg)]"
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            added={installed.has(plugin.id)}
            onOpen={onOpen}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
