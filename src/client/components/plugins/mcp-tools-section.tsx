"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Wrench, X } from "lucide-react";
import type { McpServerEntry } from "@/lib/mcp-plugin-dataset";

type ToolSummary = { name: string; description: string };

type ProbeState =
  | { status: "loading" }
  | { status: "ok"; tools: ToolSummary[] }
  | { status: "error"; message: string };

const ERROR_COPY: Record<string, string> = {
  "auth-required": "Requires authentication — sign in to this service to use it.",
  "no-tools": "Server is online but exposes no tools.",
  timeout: "Server took too long to respond.",
  "invalid-url": "Invalid server URL.",
  unavailable: "Server is not reachable right now.",
};

function probeLabel(server: McpServerEntry): string {
  return server.url ?? server.name;
}

/**
 * Live MCP capability discovery for a plugin's HTTP-transport servers.
 * Talks to the server-side proxy (`/api/plugins/mcp-tools`), which performs
 * the MCP `initialize` → `tools/list` handshake that browsers can't.
 *
 * Renders nothing when the plugin has no HTTP MCP servers.
 */
export function McpToolsSection({ servers }: { servers: McpServerEntry[] }) {
  const [states, setStates] = useState<Record<string, ProbeState>>({});

  const key = servers.map(probeLabel).join("|");

  useEffect(() => {
    if (servers.length === 0) return;
    let cancelled = false;

    setStates(
      Object.fromEntries(
        servers.map((s) => [probeLabel(s), { status: "loading" as const }]),
      ),
    );

    void Promise.all(
      servers.map(async (server) => {
        const label = probeLabel(server);
        try {
          const response = await fetch(
            `/api/plugins/mcp-tools?url=${encodeURIComponent(label)}`,
          );
          const data = (await response.json()) as
            | { ok: true; tools: ToolSummary[] }
            | { ok: false; error: string; message?: string };
          if (cancelled) {
            return [label, { status: "error", message: "" }] as const;
          }
          return data.ok
            ? ([label, { status: "ok", tools: data.tools }] as const)
            : ([
                label,
                {
                  status: "error",
                  message:
                    ERROR_COPY[data.error] ?? data.message ?? "Unavailable.",
                },
              ] as const);
        } catch {
          return [
            label,
            { status: "error", message: "Server is not reachable right now." },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStates(
        Object.fromEntries(entries.map(([label, state]) => [label, state])),
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (servers.length === 0) return null;

  const totalTools = Object.values(states).reduce(
    (sum, state) => sum + (state.status === "ok" ? state.tools.length : 0),
    0,
  );
  const anyLoading = Object.values(states).some((s) => s.status === "loading");

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ui-fg-muted)]">
        Tools
        <span className="text-[var(--ui-fg-placeholder)]">
          ·{" "}
          {anyLoading
            ? "checking…"
            : `${totalTools} live from ${
                servers.length === 1 ? "MCP server" : `${servers.length} MCP servers`
              }`}
        </span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
        <div className="divide-y divide-[var(--ui-border-subtle)]">
          {servers.map((server) => {
            const label = probeLabel(server);
            const state = states[label] ?? { status: "loading" as const };
            return (
              <div key={server.name} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--ui-muted-surface)] text-[var(--ui-fg-muted)]">
                    <Wrench className="size-[15px]" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--ui-fg)]">
                      {server.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[12.5px] leading-[18px]">
                      {state.status === "loading" ? (
                        <>
                          <Loader2
                            className="size-3 animate-spin text-[var(--ui-fg-placeholder)]"
                            strokeWidth={1.75}
                          />
                          <span className="text-[var(--ui-fg-muted)]">
                            Checking connection…
                          </span>
                        </>
                      ) : state.status === "ok" ? (
                        <>
                          <Check
                            className="size-3 text-[var(--success)]"
                            strokeWidth={2.25}
                          />
                          <span className="text-[var(--success)]">
                            Connected · {state.tools.length}{" "}
                            {state.tools.length === 1 ? "tool" : "tools"}
                          </span>
                        </>
                      ) : (
                        <>
                          <X
                            className="size-3 text-[var(--warning)]"
                            strokeWidth={2.25}
                          />
                          <span className="text-[var(--ui-fg-muted)]">
                            {state.message}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </div>
                {state.status === "ok" && state.tools.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                    {state.tools.slice(0, 12).map((tool) => (
                      <span
                        key={tool.name}
                        title={tool.description}
                        className="rounded-md bg-[var(--ui-muted-surface)] px-1.5 py-0.5 font-mono text-[11px] leading-4 text-[var(--ui-fg-muted)]"
                      >
                        {tool.name}
                      </span>
                    ))}
                    {state.tools.length > 12 ? (
                      <span className="rounded-md px-1 py-0.5 text-[11px] leading-4 text-[var(--ui-fg-placeholder)]">
                        +{state.tools.length - 12} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
