import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as apiKeysRepo from "@/backend/repositories/api-keys.repository";
import { AppError } from "@/backend/db/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const keys = await apiKeysRepo.listApiKeys(user.id);
    return jsonData({ keys });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) throw new AppError("name is required.", 400);
    const key = await apiKeysRepo.createApiKey(user.id, body.name.trim());
    return jsonData({ key }, 201);
  },
  { requireAuth: true },
);
