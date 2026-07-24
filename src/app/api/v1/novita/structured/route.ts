import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { structuredAgentCompletion } from "@/server/inference/structured-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ request }) => {
    const body = (await request.json()) as {
      model?: string;
      schemaName: string;
      schema: Record<string, unknown>;
      systemPrompt?: string;
      prompt: string;
    };

    const result = await structuredAgentCompletion({
      model: body.model,
      schemaName: body.schemaName,
      schema: body.schema,
      systemPrompt: body.systemPrompt,
      prompt: body.prompt,
      signal: request.signal,
    });

    return jsonData(result);
  },
  { requireAuth: true },
);
