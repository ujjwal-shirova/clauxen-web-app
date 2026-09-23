import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { applySharePrivacyHeaders } from "@/server/http/share-privacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Door check only. Message text is never returned here. */
export const GET = withApiRouteParams<{ token: string }>(
  async () => {
    return applySharePrivacyHeaders(jsonData({ locked: true }));
  },
  { requireAuth: false },
);
