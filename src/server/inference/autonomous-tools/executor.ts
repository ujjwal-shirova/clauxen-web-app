import {
  createSandboxKeepAlive,
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
  ensureSandboxWorkspace,
  readScopedFile,
  readScopedFileBytes,
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
  /** Model id that produced the current tool call (for agent-trace attribution). */
  modelId?: string;
  onToolProgress?: (data: Record<string, unknown>) => void;
};

export type ToolExecutionOutcome = {
  output: unknown;
  pauseForUser?: boolean;
  clarificationQuestion?: string;
};

type PublishedSandboxArtifact = {
  id: string;
  path: string;
  content?: string;
  fileId?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes: number;
};

function isTextArtifactPath(filePath: string): boolean {
  return /\.(?:txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|css|[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift|sql|sh|svg)$/i.test(
    filePath,
  );
}

function requestedOutputPaths(args: Record<string, unknown>): string[] {
  const values = Array.isArray(args.output_paths)
    ? args.output_paths
    : typeof args.output_path === "string"
      ? [args.output_path]
      : [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

type PublishSandboxOutputsResult = {
  artifacts: PublishedSandboxArtifact[];
  errors: Array<{ path: string; error: string }>;
};

async function publishSandboxOutputs(
  ctx: ToolExecutionContext,
  paths: string[],
): Promise<PublishSandboxOutputsResult> {
  const artifacts: PublishedSandboxArtifact[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const outputPath of paths) {
    try {
      const { bytes, path: normalizedPath } = await readScopedFileBytes(
        ctx,
        outputPath,
      );
      const content =
        isTextArtifactPath(normalizedPath) && bytes.byteLength <= 512 * 1024
          ? new TextDecoder().decode(bytes)
          : undefined;
      let persisted: {
        fileId: string;
        storagePath: string;
        mimeType: string;
        sizeBytes: number;
      } | null = null;
      if (ctx.userId) {
        const { persistAgentCreatedFile } = await import(
          "@/server/inference/autonomous-tools/persist-agent-file"
        );
        persisted = await persistAgentCreatedFile({
          userId: ctx.userId,
          chatId: ctx.conversationId,
          path: normalizedPath,
          content: bytes,
          source: "sandbox",
        });
      }
      artifacts.push({
        id:
          persisted?.fileId ??
          `${ctx.toolCallId ?? "artifact"}:${normalizedPath}`,
        path: normalizedPath,
        content,
        fileId: persisted?.fileId,
        storagePath: persisted?.storagePath,
        mimeType: persisted?.mimeType,
        sizeBytes: persisted?.sizeBytes ?? bytes.byteLength,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not read output path";
      errors.push({ path: outputPath, error: message });
      console.warn(`[sandbox] output_paths miss for ${outputPath}:`, message);
    }
  }
  return { artifacts, errors };
}

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
    // Signal search start immediately so the UI is not blank while Exa connects.
    ctx.onToolProgress?.({
      query,
      tool_call_id: ctx.toolCallId,
      status: "searching",
    });
    const hits = await searchWebWithExa(query, {
      userLocation: ctx.userCountryCode,
      numResults: 10,
      onStreamContent: (delta) => {
        if (!delta) return;
        ctx.onToolProgress?.({
          query,
          tool_call_id: ctx.toolCallId,
          status: "streaming",
          content_delta: delta,
        });
      },
      onPartialResults: (partial) => {
        ctx.onToolProgress?.({
          query,
          tool_call_id: ctx.toolCallId,
          status: "results",
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
    const workspace = await ensureSandboxWorkspace({
      conversationId: ctx.conversationId,
      userId: ctx.userId,
    });
    const keepAlive = createSandboxKeepAlive(workspace.sandboxId);

    const result = await runSandboxCommand(workspace.sandboxId, {
      command,
      cwd: workspace.root,
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

    const published = await publishSandboxOutputs(
      ctx,
      requestedOutputPaths(args),
    );
    return {
      output: {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        sandboxId: workspace.sandboxId,
        workspace: workspace.root,
        artifacts: published.artifacts,
        ...(published.errors.length
          ? { outputPathErrors: published.errors }
          : {}),
      },
    };
  }

  if (name === "execute_code") {
    const code = String(args.code ?? "");
    const workspace = await ensureSandboxWorkspace({
      conversationId: ctx.conversationId,
      userId: ctx.userId,
    });
    const keepAlive = createSandboxKeepAlive(workspace.sandboxId);
    const execution = await runSandboxCode(workspace.sandboxId, code, {
      cwd: workspace.root,
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

    const published = await publishSandboxOutputs(
      ctx,
      requestedOutputPaths(args),
    );
    return {
      output: {
        stdout,
        stderr,
        error,
        result: execution.results ?? null,
        sandboxId: workspace.sandboxId,
        workspace: workspace.root,
        artifacts: published.artifacts,
        ...(published.errors.length
          ? { outputPathErrors: published.errors }
          : {}),
      },
    };
  }

  if (name === "file_read") {
    const filePath = String(args.path ?? "");
    const output = await readScopedFile(ctx, filePath);
    return { output };
  }

  if (name === "create_file" || name === "file_write") {
    const filePath = String(args.path ?? "");
    const content = stripGeneratedArtifactFooter(String(args.content ?? ""));
    const output = await writeScopedFile(ctx, filePath, content);

    let persisted: {
      fileId: string;
      storagePath: string;
      mimeType: string;
      sizeBytes: number;
    } | null = null;
    if (ctx.userId) {
      try {
        const { persistAgentCreatedFile } = await import(
          "@/server/inference/autonomous-tools/persist-agent-file"
        );
        persisted = await persistAgentCreatedFile({
          userId: ctx.userId,
          chatId: ctx.conversationId,
          path: output.path,
          content,
        });
      } catch (error) {
        console.warn("[create_file] R2/Supabase persist failed:", error);
      }
    }

    // Emit an Agent Trace record so this AI-generated file is attributable.
    try {
      const { recordAgentFileContribution } = await import(
        "@/server/agent-trace/trace-store"
      );
      recordAgentFileContribution({
        type: "ai",
        filePath: output.path,
        model: ctx.modelId,
        conversationUrl: ctx.conversationId
          ? `https://clauxen.com/chat/${ctx.conversationId}`
          : undefined,
        metadata: {
          chat_id: ctx.conversationId,
          user_id: ctx.userId,
          tool_call_id: ctx.toolCallId,
          tool_name: name,
          file_id: persisted?.fileId,
          storage_path: persisted?.storagePath,
          bytes: content.length,
        },
      });
    } catch (error) {
      console.warn("[agent-trace] record failed:", error);
    }

    return {
      output: {
        ...output,
        content,
        description:
          typeof args.description === "string" ? args.description : undefined,
        ...(persisted
          ? {
              fileId: persisted.fileId,
              storagePath: persisted.storagePath,
              mimeType: persisted.mimeType,
              sizeBytes: persisted.sizeBytes,
            }
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
