/**
 * Claude Code query dependency injection — Provider-only production wiring.
 *
 * Mirrors legacy-source/src/query/deps.ts: tests can override callModel;
 * production uses Novita/Provider Messages streaming.
 */

import { randomUUID } from "crypto";
import { streamAnthropicMessages } from "@/server/agent-core/provider/messages-client";

export type QueryDeps = {
  callModel: typeof streamAnthropicMessages;
  uuid: () => string;
};

export function productionDeps(): QueryDeps {
  return {
    callModel: streamAnthropicMessages,
    uuid: randomUUID,
  };
}
