import { toUserFacingChatError } from "@/lib/assistant-generation-error";

export type ResearchStatus =
  | "pending"
  | "editing"
  | "starting"
  | "running"
  | "paused"
  | "complete"
  | "failed"
  | "cancelled";
export type ResearchTaskStatus = "pending" | "running" | "complete";
export type ResearchState = {
  id: string;
  chat_id: string;
  tool_call_id: string;
  title: string;
  tasks: string[];
  task_statuses: ResearchTaskStatus[];
  status: ResearchStatus;
  auto_start_at: string | null;
  source_count: number;
  search_count: number;
  assistant_message_id: string | null;
  error: string | null;
};
export function researchCountdown(deadline: string | null, now = Date.now()) {
  return deadline
    ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
    : 0;
}
export function researchSearchLimit(requested: unknown, research: boolean) {
  if (!research) return 10;
  return typeof requested === "number" && Number.isFinite(requested)
    ? Math.max(1, Math.min(30, Math.floor(requested)))
    : 30;
}

/** Count distinct web pages, ignoring fragments and malformed source URLs. */
export function researchSourceUrls(urls: string[]): string[] {
  const pages = new Set<string>();
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.hash = "";
      pages.add(url.toString());
    } catch {
      /* A malformed result is not a usable source. */
    }
  }
  return [...pages];
}

/** Actionable research failures without exposing provider payloads in the UI. */
export function researchFailureMessage(raw: string): string {
  if (
    /context.{0,30}(length|window|limit)|too many tokens|maximum.{0,20}tokens|payload too large/i.test(
      raw,
    )
  ) {
    return "The research evidence exceeded the model's context limit. Retry research to continue with shorter excerpts.";
  }
  if (
    /model provider (stopped responding|did not send output)|timeout|timed out|deadline/i.test(
      raw,
    )
  ) {
    return "The model stopped responding. Retry research to continue from saved progress.";
  }
  return toUserFacingChatError(raw);
}
