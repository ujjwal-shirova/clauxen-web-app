import { env } from "@/backend/config/env";
import {
  fetchUrlContentsWithExa,
  isExaConfigured,
  searchWebWithExa,
} from "@/backend/search/exa";
import {
  getOrCreateSandbox,
  readSandboxFile,
  writeSandboxFile,
  runSandboxCommand,
  runSandboxCode,
} from "@/backend/sandbox/sandbox-manager";
import {
  inferLanguage,
  type PlatformToolName,
} from "@/backend/inference/platform-tools";
import {
  browserUseRecipe,
  desktopRecipe,
} from "@/backend/inference/novita-agent-recipes";

export type ToolEventSender = (event: string, data: unknown) => void;

function parseArgs(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function resolveSandboxId(context?: {
  userId?: string;
  conversationId?: string;
}) {
  const { info } = await getOrCreateSandbox(context);
  return info.sandboxId;
}

export async function executePlatformTool(
  name: PlatformToolName | string,
  rawArgs: string | undefined,
  send: ToolEventSender,
  context?: { userId?: string; conversationId?: string },
): Promise<string> {
  const args = parseArgs(rawArgs);

  switch (name as PlatformToolName) {
    case "get_current_time":
      return JSON.stringify({
        iso: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

    case "summarize_attached_media":
      return JSON.stringify({
        media_count: Number(args.media_count ?? 0),
        media_types: Array.isArray(args.media_types) ? args.media_types : [],
      });

    case "create_browser_sandbox_recipe":
      return JSON.stringify({
        language: "python",
        install: "pip install browser-use e2b-code-interpreter",
        environment: {
          E2B_DOMAIN: "sandbox.novita.ai",
          NOVITA_API_KEY: "required",
          LLM_API_KEY: "required",
          LLM_BASE_URL: "https://api.novita.ai/anthropic",
        },
        code: browserUseRecipe(
          String(args.task ?? "Open example.com"),
          String(args.model ?? env.defaultModel),
        ),
      });

    case "create_desktop_sandbox_recipe":
      return JSON.stringify({
        language: "python",
        install: "pip install e2b-desktop==2.0.1",
        environment: {
          E2B_DOMAIN: "sandbox.novita.ai",
          E2B_API_KEY: "required",
        },
        code: desktopRecipe(Boolean(args.view_only)),
      });

    case "create_file": {
      const path = String(args.path ?? "");
      const content = String(args.file_text ?? args.content ?? "");
      const description = String(args.description ?? "");
      const sandboxId = await resolveSandboxId(context);
      await writeSandboxFile(sandboxId, path, content);
      send("file_created", {
        path,
        content,
        description,
        language: inferLanguage(path),
      });
      send("sandbox_ready", { auto_created: true, sandboxId });
      return `File created at ${path} (${content.length} chars).`;
    }

    case "bash_tool": {
      const command = String(args.command ?? "");
      const description = String(args.description ?? "");
      const sandboxId = await resolveSandboxId(context);
      send("sandbox_ready", { auto_created: true, sandboxId });
      const result = await runSandboxCommand(sandboxId, {
        command,
        onStdout: (text) => send("bash_stdout", { text, description }),
        onStderr: (text) => send("bash_stderr", { text, description }),
      });
      return JSON.stringify(result);
    }

    case "view": {
      const path = String(args.path ?? "");
      const viewRange = args.view_range as [number, number] | undefined;
      const sandboxId = await resolveSandboxId(context);
      const content = await readSandboxFile(sandboxId, path);
      if (viewRange) {
        const lines = content.split("\n");
        const [start, end] = viewRange;
        return lines
          .slice(start - 1, end === -1 ? undefined : end)
          .map((line, i) => `${start + i}\t${line}`)
          .join("\n");
      }
      return content;
    }

    case "str_replace": {
      const path = String(args.path ?? "");
      const oldStr = String(args.old_str ?? "");
      const newStr = String(args.new_str ?? "");
      const sandboxId = await resolveSandboxId(context);
      const content = await readSandboxFile(sandboxId, path);
      const count = content.split(oldStr).length - 1;
      if (count === 0) throw new Error(`old_str not found in ${path}`);
      if (count > 1) {
        throw new Error(
          `old_str appears ${count} times in ${path}; must be unique`,
        );
      }
      const updated = content.replace(oldStr, newStr);
      await writeSandboxFile(sandboxId, path, updated);
      send("file_updated", {
        path,
        content: updated,
        language: inferLanguage(path),
      });
      return `Replaced content in ${path}`;
    }

    case "present_files": {
      const filepaths = Array.isArray(args.filepaths)
        ? (args.filepaths as string[])
        : [];
      const sandboxId = await resolveSandboxId(context);
      for (const path of filepaths) {
        const content = await readSandboxFile(sandboxId, path);
        send("file_created", {
          path,
          content,
          language: inferLanguage(path),
          description: "Presented file",
        });
      }
      return `Presented ${filepaths.length} file(s).`;
    }

    case "web_search": {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return JSON.stringify({ error: "query is required" });
      }
      if (!isExaConfigured()) {
        return JSON.stringify({
          error: "EXA_API_KEY is not configured",
          query,
        });
      }
      try {
        const results = await searchWebWithExa(query);
        send("web_search_results", { query, results });
        return JSON.stringify(results);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Exa search failed";
        return JSON.stringify({ error: message, query });
      }
    }

    case "web_fetch": {
      const url = String(args.url ?? "").trim();
      if (!url) {
        return JSON.stringify({ error: "url is required" });
      }

      if (isExaConfigured()) {
        try {
          const [result] = await fetchUrlContentsWithExa([url]);
          if (result?.snippet) {
            return result.snippet;
          }
        } catch {
          // fall through to direct fetch
        }
      }

      const response = await fetch(url, {
        headers: { "User-Agent": "Clauxen-Agent/1.0" },
      });
      const text = await response.text();
      const stripped = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50_000);
      return stripped;
    }

    case "weather_fetch": {
      const location = String(args.location_name ?? args.location ?? "");
      let lat = Number(args.latitude);
      let lon = Number(args.longitude);
      if (!lat || !lon) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
        );
        const geo = (await geoRes.json()) as {
          results?: Array<{ latitude: number; longitude: number }>;
        };
        lat = geo.results?.[0]?.latitude ?? 0;
        lon = geo.results?.[0]?.longitude ?? 0;
      }
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`,
      );
      const weatherData = await weatherRes.json();
      send("weather_data", { location, data: weatherData });
      return JSON.stringify(weatherData);
    }

    case "places_search": {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? "";
      const queries = Array.isArray(args.queries)
        ? (args.queries as Array<{ query: string; max_results?: number }>)
        : [];
      if (!apiKey) {
        return JSON.stringify({
          error: "GOOGLE_PLACES_API_KEY not configured",
          queries,
        });
      }
      const results: unknown[] = [];
      for (const q of queries) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q.query)}&key=${apiKey}`,
        );
        const data = (await res.json()) as {
          results?: Array<{
            name: string;
            formatted_address: string;
            rating?: number;
            geometry: { location: { lat: number; lng: number } };
            place_id: string;
          }>;
        };
        results.push({
          query: q.query,
          places: (data.results ?? [])
            .slice(0, q.max_results ?? 5)
            .map((p) => ({
              name: p.name,
              address: p.formatted_address,
              rating: p.rating,
              lat: p.geometry.location.lat,
              lng: p.geometry.location.lng,
              place_id: p.place_id,
            })),
        });
      }
      send("places_data", { results });
      return JSON.stringify(results);
    }

    case "run_code_interpreter": {
      const language = String(args.language ?? "python");
      const code = String(args.code ?? "");
      const sandboxId = await resolveSandboxId(context);
      send("sandbox_ready", { auto_created: true, sandboxId });
      if (language === "python") {
        const result = await runSandboxCode(sandboxId, code);
        send("code_executed", { language, code, result });
        return JSON.stringify({
          stdout: result.text ?? result.logs?.stdout?.join("") ?? "",
          stderr: result.logs?.stderr?.join("") ?? "",
          output: result.results ?? [],
          error: result.error,
        });
      }
      const ext = language === "typescript" ? "ts" : "js";
      const filename = `/tmp/code_${Date.now()}.${ext}`;
      await writeSandboxFile(sandboxId, filename, code);
      const cmd =
        language === "typescript"
          ? `npx ts-node ${filename}`
          : `node ${filename}`;
      const result = await runSandboxCommand(sandboxId, { command: cmd });
      send("code_executed", { language, code, result });
      return JSON.stringify(result);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
