import { handleBroker } from "./broker";
import { canonicalEmail } from "./identity";
import { enabled, ORIGIN, json } from "./protocol";
export { OAuthFlow } from "./flow";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (["www.clauxen.com", "clauxen.com"].includes(url.hostname) && url.pathname === "/auth/oauth") {
      const response = await env.APP.fetch(request);
      const location = response.headers.get("Location");
      if (!location) return response;
      const destination = new URL(location, request.url);
      if (destination.origin === "https://ntplcfsbcyhiqklkbldk.supabase.co" && destination.pathname === "/auth/v1/authorize" && enabled(destination.searchParams.get("provider"), env.BROKER_PROVIDERS)) {
        destination.host = new URL(ORIGIN).host;
        const headers = new Headers(response.headers);
        headers.set("Location", destination.href);
        headers.set("Cache-Control", "no-store, private");
        return new Response(response.body, { status: response.status, headers });
      }
      return response;
    }
    if (["www.clauxen.com", "clauxen.com"].includes(url.hostname)) return env.APP.fetch(request);
    if (!(await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" })).success)
      return json({ error: "rate_limit_exceeded" }, 429);
    return handleBroker(request, {
      secret: env.BROKER_CLIENT_SECRET,
      credentials: provider => provider === "github" ? { id: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET } : { id: env.GITLAB_CLIENT_ID, secret: env.GITLAB_CLIENT_SECRET },
      flow: id => env.OAUTH_FLOWS.getByName(id),
      canonicalEmail: (provider, subject, email) => canonicalEmail(env.HYPERDRIVE.connectionString, provider, subject, email),
      fetcher: fetch,
    });
  },
} satisfies ExportedHandler<BrokerEnv>;
