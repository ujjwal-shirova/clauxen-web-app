import {
  createSandboxKeepAlive,
  getOrCreateSandbox,
  runSandboxCode,
  runSandboxCommand,
} from "@/server/sandbox/sandbox-manager";
import { searchWebWithExa } from "@/server/search/exa";
import { fetchUrlContentsWithExa } from "@/server/search/exa";
import { assertSafeBashCommand } from "@/server/inference/bash-safety";
import {
  fetchWeatherForecast,
  geocodeLocation,
  type WeatherUnits,
} from "@/server/weather/open-meteo";
import { searchPlaces } from "@/server/search/nominatim";
import { searchImages } from "@/server/search/openverse";
import { listAvailableSkills, readSkill } from "@/server/inference/autonomous-tools/skill-catalog";
import {
  readScopedFile,
  writeScopedFile,
} from "@/server/inference/autonomous-tools/workspace";

const GENERATED_FOOTER_RE =
  /(?:\r?\n){0,3}(?:[-*_]\s*)?(?:This\s+(?:document|file|code|artifact)\s+was\s+generated\s+by\s+clauxen\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\.?|Generated\s+by\s+clauxen\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\.?)\s*$/i;

function stripGeneratedArtifactFooter(content: string): string {
  return content.replace(GENERATED_FOOTER_RE, "").replace(/\s+$/g, "");
}

export type ToolExecutionContext = {
  conversationId: string;
  userId?: string;
  userCountryCode?: string;
  toolCallId?: string;
  onToolProgress?: (data: Record<string, unknown>) => void;
};

export type ToolExecutionOutcome = {
  output: unknown;
  pauseForUser?: boolean;
  clarificationQuestion?: string;
};

export async function executeAutonomousTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<ToolExecutionOutcome> {
  if (name === "read_skill") {
    const skillId = String(args.skill_id ?? args.name ?? "");
    const available = await listAvailableSkills();
    const skill = await readSkill(skillId);
    if (!skill) {
      return {
        output: {
          error: `Skill not found: ${skillId}`,
          available: available.map((s) => ({
            id: s.id,
            description: s.description,
          })),
        },
      };
    }
    return {
      output: {
        id: skill.id,
        path: skill.path,
        content: skill.content,
      },
    };
  }

  if (name === "web_search") {
    const query = String(args.query ?? "");
    const hits = await searchWebWithExa(query, {
      userLocation: ctx.userCountryCode,
      numResults: 10,
      onPartialResults: (partial) => {
        ctx.onToolProgress?.({
          query,
          tool_call_id: ctx.toolCallId,
          results: partial.slice(0, 10).map((h, i) => ({
            index: i + 1,
            title: h.title,
            url: h.url,
            snippet: h.snippet,
            publishedDate: h.publishedDate,
            favicon: h.favicon,
            highlights: h.highlights,
          })),
        });
      },
    });
    return {
      output: {
        query,
        results: hits.slice(0, 10).map((h, i) => ({
          index: i + 1,
          title: h.title,
          url: h.url,
          snippet: h.snippet,
          publishedDate: h.publishedDate,
          favicon: h.favicon,
          highlights: h.highlights,
        })),
        searchType: "auto",
      },
    };
  }

  if (name === "web_fetch") {
    const url = String(args.url ?? "").trim();
    if (!url) throw new Error("url is required");

    // Exa-only — never fall back to raw fetch (SSRF risk to private/metadata IPs).
    try {
      const [hit] = await fetchUrlContentsWithExa([url]);
      if (hit?.snippet) {
        return {
          output: {
            url: hit.url,
            title: hit.title,
            snippet: hit.snippet,
          },
        };
      }
      return {
        output: {
          url,
          error: "No fetchable content returned for this URL.",
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "URL fetch failed";
      return { output: { url, error: message } };
    }
  }

  if (name === "image_search") {
    const query = String(args.query ?? "").trim();
    if (!query) throw new Error("query is required");
    const maxResults = Number(args.max_results ?? 3);
    const images = await searchImages(query, maxResults);
    return { output: { query, images } };
  }

  if (name === "places_search") {
    const query = String(args.query ?? "").trim();
    if (!query) throw new Error("query is required");
    const maxResults = Number(args.max_results ?? 5);
    const results = await searchPlaces(query, maxResults);
    return { output: { query, results } };
  }

  if (name === "weather_fetch") {
    const locationName = String(args.location_name ?? "").trim();
    if (!locationName) throw new Error("location_name is required");
    const units: WeatherUnits = args.units === "imperial" ? "imperial" : "metric";

    const place = await geocodeLocation(locationName);
    if (!place) {
      return {
        output: { error: `Could not find a location matching "${locationName}".` },
      };
    }

    const forecast = await fetchWeatherForecast(place, units);
    return { output: forecast };
  }

  if (name === "bash_tool") {
    const command = String(args.command ?? "");
    assertSafeBashCommand(command);
    const { info } = await getOrCreateSandbox({
      conversationId: ctx.conversationId,
      userId: ctx.userId,
    });
    const keepAlive = createSandboxKeepAlive(info.sandboxId);

    const result = await runSandboxCommand(info.sandboxId, {
      command,
      onStdout: (text) => {
        keepAlive.ping();
        ctx.onToolProgress?.({
          tool_call_id: ctx.toolCallId,
          kind: "stdout",
          delta: text,
        });
      },
      onStderr: (text) => {
        keepAlive.ping();
        ctx.onToolProgress?.({
          tool_call_id: ctx.toolCallId,
          kind: "stderr",
          delta: text,
        });
      },
    });

    return {
      output: {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        sandboxId: info.sandboxId,
      },
    };
  }

  if (name === "execute_code") {
    const code = String(args.code ?? "");
    const { info } = await getOrCreateSandbox({ conversationId: ctx.conversationId });
    const execution = await runSandboxCode(info.sandboxId, code);
    const stdout =
      execution.logs?.stdout?.join("") ??
      (typeof execution.text === "string" ? execution.text : "");
    const stderr = execution.logs?.stderr?.join("") ?? "";
    const error =
      execution.error != null
        ? typeof execution.error === "string"
          ? execution.error
          : JSON.stringify(execution.error)
        : null;

    return {
      output: {
        stdout,
        stderr,
        error,
        result: execution.results ?? null,
      },
    };
  }

  if (name === "file_read") {
    const filePath = String(args.path ?? "");
    const output = await readScopedFile(ctx.conversationId, filePath);
    return { output };
  }

  if (name === "create_file" || name === "file_write") {
    const filePath = String(args.path ?? "");
    const content = stripGeneratedArtifactFooter(String(args.content ?? ""));
    const output = await writeScopedFile(ctx.conversationId, filePath, content);

    let persisted: { fileId: string; storagePath: string } | null = null;
    if (ctx.userId) {
      try {
        const { persistAgentCreatedFile } = await import(
          "@/server/inference/autonomous-tools/persist-agent-file"
        );
        persisted = await persistAgentCreatedFile({
          userId: ctx.userId,
          chatId: ctx.conversationId,
          path: filePath,
          content,
        });
      } catch (error) {
        console.warn("[create_file] R2/Supabase persist failed:", error);
      }
    }

    return {
      output: {
        ...output,
        content,
        description:
          typeof args.description === "string" ? args.description : undefined,
        ...(persisted
          ? { fileId: persisted.fileId, storagePath: persisted.storagePath }
          : {}),
      },
    };
  }

  if (name === "present_files") {
    // Deprecated: create_file already presents. Keep a quiet success stub so
    // older model turns that still emit this tool don't error the loop.
    return {
      output: {
        presented: [],
        files: [],
        deprecated: true,
        message: "present_files is no longer required — create_file auto-presents.",
      },
    };
  }

  if (name === "ask_user_input_v0") {
    const questions = Array.isArray(args.questions) ? args.questions : [];
    return {
      output: {
        status: "pending_user_input",
        message:
          "Interactive questionnaire presented to the user. Awaiting user response.",
        questionsCount: questions.length,
      },
      pauseForUser: true,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}
