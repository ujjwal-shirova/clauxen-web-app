import { withApiHandler } from "@/backend/http/api-handler"; // shared API wrapper — auth, errors, logging
import { jsonData } from "@/backend/http/api-response"; // consistent JSON success envelope
import { requireSession } from "@/backend/auth/require-session";
import * as artifactsRepo from "@/backend/repositories/artifacts.repository"; // DB layer — artifacts CRUD
import { AppError } from "@/backend/db/errors"; // typed HTTP errors (status + code)

const ARTIFACT_KINDS = new Set([
  "app",
  "document",
  "spreadsheet",
  "presentation",
  "image",
  "code",
  "other",
]);
const MAX_ARTIFACT_TITLE_LENGTH = 200;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const artifacts = await artifactsRepo.listArtifacts(user.id);
    return jsonData({ artifacts }); // { data: { artifacts: [...] } } shape
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: { title?: string; kind?: string };
    try {
      body = (await request.json()) as { title?: string; kind?: string };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new AppError("title is required.", 400);
    if (title.length > MAX_ARTIFACT_TITLE_LENGTH) {
      throw new AppError("title is too long.", 400);
    }
    let kind = body.kind ?? "document";
    if (kind === "template") kind = "other";
    if (!ARTIFACT_KINDS.has(kind)) {
      throw new AppError("Invalid artifact kind.", 400);
    }
    const artifact = await artifactsRepo.createArtifact({
      userId: user.id,
      title,
      kind,
    });
    return jsonData({ artifact }, 201);
  },
  { requireAuth: true },
);
