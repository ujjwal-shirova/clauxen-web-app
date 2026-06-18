/**
 * Tool steering encoded in schemas — not runtime branches.
 * The model reads these descriptions; the server never decides when to search.
 *
 * Pecking order (documented for tool authors, reflected in description text):
 * 1. read_skill — mandatory before execute_code / file_write (sandbox facts)
 * 2. First-party connectors (future) — user's own data before web
 * 3. web_search / web_fetch — world knowledge, current events
 * 4. execute_code — verify by running
 * 5. file_read / file_write — scoped workspace artifacts
 * 6. ask_user_clarification — pause instead of guessing
 */
export const TOOL_STEERING_ORDER = [
  "read_skill",
  "web_search",
  "web_fetch",
  "execute_code",
  "file_read",
  "file_write",
  "ask_user_clarification",
] as const;

export type AutonomousToolName = (typeof TOOL_STEERING_ORDER)[number];

export function toolLabelForUi(name: string): string {
  switch (name) {
    case "web_search":
      return "Searched the web";
    case "web_fetch":
      return "Fetched page content";
    case "execute_code":
      return "Ran code";
    case "file_read":
      return "Read file";
    case "file_write":
      return "Wrote file";
    case "read_skill":
      return "Read skill";
    case "ask_user_clarification":
      return "Asked for clarification";
    default:
      return name;
  }
}
