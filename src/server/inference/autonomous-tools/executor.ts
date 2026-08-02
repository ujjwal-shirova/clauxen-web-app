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

async function publishSandboxOutputs(
  ctx: ToolExecutionContext,
  paths: string[],
): Promise<PublishedSandboxArtifact[]> {
  const artifacts: PublishedSandboxArtifact[] = [];
  for (const outputPath of paths) {
    const { bytes } = await readScopedFileBytes(ctx, outputPath);
    const normalizedPath = outputPath.replace(/^\/+/, "");
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
      id: persisted?.fileId ?? `${ctx.toolCallId ?? "artifact"}:${normalizedPath}`,
      path: normalizedPath,
      content,
      fileId: persisted?.fileId,
      storagePath: persisted?.storagePath,
      mimeType: persisted?.mimeType,
      sizeBytes: persisted?.sizeBytes ?? bytes.byteLength,
    });
  }
  return artifacts;
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

    const artifacts = await publishSandboxOutputs(
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
        artifacts,
      },
    };
  }

  if (name === "execute_code") {
    const code = String(args.code ?? "");
    const workspace = await ensureSandboxWorkspace({
      conversationId: ctx.conversationId,
      userId: ctx.userId,
    });
    const execution = await runSandboxCode(workspace.sandboxId, code, {
      cwd: workspace.root,
      onStdout: (text) =>
        ctx.onToolProgress?.({
          tool_call_id: ctx.toolCallId,
          kind: "stdout",
          delta: text,
        }),
      onStderr: (text) =>
        ctx.onToolProgress?.({
          tool_call_id: ctx.toolCallId,
          kind: "stderr",
          delta: text,
        }),
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

    const artifacts = await publishSandboxOutputs(
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
        artifacts,
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

  if (name === "create_scheduled_task") {
    if (!ctx.userId) {
      return {
        output: {
          error: "Sign in required to create scheduled tasks.",
        },
      };
    }
    try {
      const { createTask } = await import(
        "@/server/services/scheduled-tasks.service"
      );
      const asOptionalString = (v: unknown): string | null => {
        if (typeof v !== "string") return null;
        const t = v.trim();
        return t.length ? t : null;
      };
      const asOptionalNumber = (v: unknown): number | null => {
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        return v;
      };
      const task = await createTask(ctx.userId, {
        name: String(args.name ?? ""),
        requirement: String(args.requirement ?? ""),
        frequency: args.frequency as "once" | "daily" | "weekly" | "monthly",
        timeLocal: String(args.time_local ?? args.timeLocal ?? ""),
        timezone: String(args.timezone ?? "UTC"),
        runDate: asOptionalString(args.run_date ?? args.runDate),
        dayOfWeek: asOptionalNumber(args.day_of_week ?? args.dayOfWeek),
        dayOfMonth: asOptionalNumber(args.day_of_month ?? args.dayOfMonth),
        expiresAt: asOptionalString(args.expires_at ?? args.expiresAt),
        source: "chat",
      });
      return {
        output: {
          ok: true,
          task: {
            id: task.id,
            name: task.name,
            frequency: task.frequency,
            time_local: task.time_local,
            timezone: task.timezone,
            next_run_at: task.next_run_at,
            expires_at: task.expires_at,
            status: task.status,
          },
          manage_url: "/scheduled",
        },
      };
    } catch (error) {
      return {
        output: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create scheduled task.",
        },
      };
    }
  }

  if (name === "list_scheduled_tasks") {
    if (!ctx.userId) {
      return {
        output: { error: "Sign in required to list scheduled tasks." },
      };
    }
    try {
      const { listTasks } = await import(
        "@/server/services/scheduled-tasks.service"
      );
      const includeCompleted = args.include_completed !== false;
      const tasks = (await listTasks(ctx.userId)).filter((t) =>
        includeCompleted ? true : t.status !== "completed",
      );
      return {
        output: {
          tasks: tasks.map((t) => ({
            id: t.id,
            name: t.name,
            frequency: t.frequency,
            time_local: t.time_local,
            timezone: t.timezone,
            next_run_at: t.next_run_at,
            status: t.status,
            expires_at: t.expires_at,
            run_count: t.run_count,
          })),
          manage_url: "/scheduled",
        },
      };
    } catch (error) {
      return {
        output: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to list scheduled tasks.",
        },
      };
    }
  }

  if (name === "cancel_scheduled_task") {
    if (!ctx.userId) {
      return {
        output: { error: "Sign in required to cancel scheduled tasks." },
      };
    }
    const taskId = String(args.task_id ?? args.taskId ?? "");
    if (!taskId) {
      return { output: { error: "task_id is required." } };
    }
    try {
      const { deleteTask } = await import(
        "@/server/services/scheduled-tasks.service"
      );
      await deleteTask(taskId, ctx.userId);
      return { output: { ok: true, task_id: taskId } };
    } catch (error) {
      return {
        output: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to cancel scheduled task.",
        },
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}
