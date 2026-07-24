import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { listNovitaModels } from "@/server/inference/novita-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request }) => {
    const models = await listNovitaModels(request.signal);
    return jsonData(models);
  },
  { requireAuth: true },
);
