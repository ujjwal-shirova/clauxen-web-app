import {
  getOrCreateSandbox,
  runSandboxCode,
} from "@/backend/sandbox/sandbox-manager";
import { searchWebWithExa } from "@/backend/search/exa";
import { fetchUrlContentsWithExa } from "@/backend/search/exa";
import { listAvailableSkills, readSkill } from "@/backend/inference/autonomous-tools/skill-catalog";
import {
  readScopedFile,
  writeScopedFile,
} from "@/backend/inference/autonomous-tools/workspace";

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
      onPartialResults: (partial) => {
        ctx.onToolProgress?.({
          query,
          tool_call_id: ctx.toolCallId,
          results: partial.slice(0, 8).map((h) => ({
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
        results: hits.slice(0, 8).map((h) => ({
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
    } catch {
      // fall through
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "Clauxen-Agent/1.0" },
    });
    const text = await response.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      output: {
        url,
        title: url,
        snippet: stripped.slice(0, 8000),
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

  if (name === "file_write") {
    const filePath = String(args.path ?? "");
    const content = String(args.content ?? "");
    const output = await writeScopedFile(ctx.conversationId, filePath, content);
    return { output: { ...output, content } };
  }

  if (name === "ask_user_clarification") {
    const question = String(args.question ?? "");
    return {
      output: { status: "waiting_for_user", question },
      pauseForUser: true,
      clarificationQuestion: question,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}
