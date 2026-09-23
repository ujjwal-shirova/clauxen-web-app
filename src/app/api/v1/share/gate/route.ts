import { withApiRoute } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { applySharePrivacyHeaders } from "@/server/http/share-privacy";
import { resolveTurnstileKeys } from "@/server/chat/turnstile";
import { env } from "@/server/config/env";
import { TURNSTILE_TEST_SECRET } from "@/lib/share-public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRoute(
  async () => {
    const keys = resolveTurnstileKeys();
    const workerReady = Boolean(
      keys &&
        keys.secret !== TURNSTILE_TEST_SECRET &&
        env.shareWorkerPublicUrl,
    );
    return applySharePrivacyHeaders(
      jsonData({
        siteKey: keys?.siteKey ?? null,
        workerUrl: workerReady ? env.shareWorkerPublicUrl : null,
      }),
    );
  },
  { requireAuth: false },
);
