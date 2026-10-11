import type { MessageBatch } from "@cloudflare/workers-types";

export type GenerationMessage =
  | { jobId: string; researchPlanId?: never }
  | { researchPlanId: string; jobId?: never };

/** Keep the queue event alive until the generation slice has actually finished. */
export async function consumeGenerationQueue(
  batch: MessageBatch<GenerationMessage>,
  env: Pick<
    CloudflareEnv,
    "CHAT_COORD_INTERNAL_TOKEN" | "GENERATIONS_EXECUTION_ORIGIN"
  > &
    Partial<
      Pick<
        CloudflareEnv,
        "GENERATIONS_INTERNAL_TOKEN" | "SCHEDULED_TASKS_INTERNAL_TOKEN"
      >
    >,
  execute: (request: Request) => Promise<Response>,
) {
  const token =
    env.GENERATIONS_INTERNAL_TOKEN?.trim() ||
    env.CHAT_COORD_INTERNAL_TOKEN?.trim() ||
    env.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim();
  if (!token)
    throw new Error("Generation queue authentication is not configured");
  for (const message of batch.messages) {
    try {
      const response = await execute(
        new Request(
          `${env.GENERATIONS_EXECUTION_ORIGIN}/api/v1/internal/${message.body.researchPlanId ? "research/start" : "generations/continue"}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-clauxen-internal": token,
              "x-clauxen-queue-execution": "1",
            },
            body: JSON.stringify(message.body),
          },
        ),
      );
      await response.body?.cancel();
      if (response.ok || response.status === 409) message.ack();
      else message.retry({ delaySeconds: 30 });
    } catch (error) {
      console.error("[generation-queue] slice request failed", {
        jobId: message.body.jobId,
        researchPlanId: message.body.researchPlanId,
        error: error instanceof Error ? error.message : String(error),
      });
      message.retry({ delaySeconds: 30 });
    }
  }
}
