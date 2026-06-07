import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { listNovitaModels } from "@/backend/inference/novita-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request }) => {
    const models = await listNovitaModels(request.signal);
    return jsonData(models);
  },
  { requireChatAuth: true },
);
