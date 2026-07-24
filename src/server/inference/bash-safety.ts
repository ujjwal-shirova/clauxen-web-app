/** Shared bash_tool guardrails — used by every executor that runs bash_tool. */
export const MAX_BASH_COMMAND_CHARS = 8_000;

export const BLOCKED_BASH_PATTERNS = [
  /\brm\s+-rf\s+\/\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,
  /\bchmod\s+-R\s+777\s+\//i,
  /\bcurl\b[^\n|]*\|\s*(ba)?sh\b/i,
  /\bwget\b[^\n|]*\|\s*(ba)?sh\b/i,
];

export function assertSafeBashCommand(command: string) {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("Bash command is required.");
  }
  if (trimmed.length > MAX_BASH_COMMAND_CHARS) {
    throw new Error("Bash command exceeds maximum length.");
  }
  for (const pattern of BLOCKED_BASH_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error("This bash command is blocked for safety.");
    }
  }
}
