/** OpenAI Responses query dependency injection. */

import { randomUUID } from "crypto";
import { streamOpenAIResponse } from "@/server/agent-core/provider/messages-client";

export type QueryDeps = {
  callModel: typeof streamOpenAIResponse;
  uuid: () => string;
};

export function productionDeps(): QueryDeps {
  return {
    callModel: streamOpenAIResponse,
    uuid: randomUUID,
  };
}
