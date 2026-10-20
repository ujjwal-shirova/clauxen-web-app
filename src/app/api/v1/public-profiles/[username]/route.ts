import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import * as profileService from "@/server/services/profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ username: string }>(
  async ({ params }) => {
    const username = params.username;
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return jsonData({ profile: null });
    }
    const profile = await profileService.getPublicProfile(username);
    return jsonData({ profile });
  },
);
