import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { executeAgentTool } from "@/backend/inference/novita-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ request }) => {
    const body = (await request.json()) as {
      kind?: "browser" | "desktop";
      task?: string;
      model?: string;
      viewOnly?: boolean;
    };

    const content =
      body.kind === "desktop"
        ? await executeAgentTool(
            "create_desktop_sandbox_recipe",
            JSON.stringify({ view_only: body.viewOnly ?? true }),
          )
        : await executeAgentTool(
            "create_browser_sandbox_recipe",
            JSON.stringify({
              task:
                body.task || "Open Hacker News and summarize the top stories.",
              model: body.model,
            }),
          );

    return jsonData(JSON.parse(content) as unknown);
  },
  { requireChatAuth: true },
);
