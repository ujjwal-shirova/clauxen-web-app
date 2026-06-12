import { withApiHandler } from "@/backend/http/api-handler"; // session + centralized error wrapper
import { jsonData } from "@/backend/http/api-response"; // { data } success JSON envelope
import { requireSession } from "@/backend/auth/require-session"; // null session → 401 throw
import { AppError, notFound } from "@/backend/db/errors"; // validation 400, missing skill 404
import * as customizeRepo from "@/backend/repositories/customize.repository"; // instruction profiles CRUD — parameterized SQL

const SKILL_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SKILL_TITLE_LENGTH = 200;
const MAX_SKILL_INSTRUCTIONS_LENGTH = 100_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const skills = await customizeRepo.listInstructionProfiles(user.id); // DB: user_id filter, title + instructions rows
    return jsonData({ skills });
  },
  { requireAuth: true }, // anonymous caller → 401 before handler body
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: { title?: string; instructions?: string; id?: string };
    try {
      body = (await request.json()) as {
        title?: string;
        instructions?: string;
        id?: string;
      };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    if (
      body.id !== undefined &&
      (typeof body.id !== "string" || !SKILL_ID_RE.test(body.id))
    ) {
      throw new AppError("Invalid skill id.", 400, "bad_request");
    }
    if (
      typeof body.title === "string" &&
      body.title.length > MAX_SKILL_TITLE_LENGTH
    ) {
      throw new AppError("title is too long.", 400);
    }
    if (
      typeof body.instructions === "string" &&
      body.instructions.length > MAX_SKILL_INSTRUCTIONS_LENGTH
    ) {
      throw new AppError("instructions are too long.", 400);
    }
    const title =
      typeof body.title === "string"
        ? body.title.trim().slice(0, MAX_SKILL_TITLE_LENGTH) || "Custom skill"
        : "Custom skill";
    const instructions =
      typeof body.instructions === "string"
        ? body.instructions.slice(0, MAX_SKILL_INSTRUCTIONS_LENGTH)
        : "";
    const skill = await customizeRepo.upsertInstructionProfile({
      userId: user.id,
      id: body.id,
      title,
      instructions,
    });
    if (!skill) throw notFound("Skill not found.");
    return jsonData({ skill }, 201);
  },
  { requireAuth: true },
);
