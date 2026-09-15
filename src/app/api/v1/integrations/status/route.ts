import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasEnv(...names: string[]) {
  return names.some((name) => (process.env[name] ?? "").trim().length > 0);
}

/**
 * Integration status for the /connect page. Returns presence booleans only —
 * token values never leave the server.
 */
export const GET = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    return jsonData({
      vercel: { tokenConfigured: hasEnv("VERCEL_TOKEN", "Vercel_Token") },
      supabase: {
        tokenConfigured: hasEnv("SUPABASE_ACCESS_TOKEN", "Supabase_Token"),
      },
      cloudflare: {
        tokenConfigured: hasEnv("CLOUDFLARE_API_TOKEN", "Cloudflare_Token"),
        accountIdConfigured: hasEnv("CLOUDFLARE_ACCOUNT_ID"),
      },
    });
  },
  { requireAuth: true },
);
