import { cloudflareContext } from "@/server/cloudflare/context";

type AgentEnvironment = {
  GITHUB_AGENT?: Fetcher;
  GITHUB_AGENT_INTERNAL_TOKEN?: string;
};
/** Called only with the authenticated execution context's user ID, never model input. */
export async function executeGitHubAgent(
  userId: string,
  operation: string,
  args: Record<string, unknown>,
) {
  const bindings = cloudflareContext()?.env as AgentEnvironment | undefined;
  const token =
    bindings?.GITHUB_AGENT_INTERNAL_TOKEN ??
    process.env.GITHUB_AGENT_INTERNAL_TOKEN;
  if (!token) throw new Error("GitHub Agent is not configured on this server.");
  const request = new Request(
    "https://www.clauxen.com/api/v1/github/internal/execute",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-clauxen-internal-token": token,
      },
      body: JSON.stringify({ user_id: userId, operation, arguments: args }),
      signal: AbortSignal.timeout(90000),
    },
  );
  const response = bindings?.GITHUB_AGENT
    ? await bindings.GITHUB_AGENT.fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ user_id: userId, operation, arguments: args }),
      })
    : await fetch(request);
  const value = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(value.error?.message ?? "GitHub operation failed.");
  return value.data;
}
