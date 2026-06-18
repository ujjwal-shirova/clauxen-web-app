import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError, notFound } from "@/backend/db/errors";
import * as customizeRepo from "@/backend/repositories/customize.repository";
import * as userSkillsRepo from "@/backend/repositories/user-skills.repository";
import { deleteObject } from "@/backend/storage/object-store";

const SKILL_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SKILL_TITLE_LENGTH = 200;
const MAX_SKILL_INSTRUCTIONS_LENGTH = 100_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const [textSkills, fileSkills] = await Promise.all([
      customizeRepo.listInstructionProfiles(user.id),
      userSkillsRepo.listUserSkills(user.id),
    ]);
    return jsonData({
      skills: textSkills,
      fileSkills,
    });
  },
  { requireAuth: true },
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

export const DELETE = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("id");
    const kind = searchParams.get("kind") ?? "file";

    if (!skillId || !SKILL_ID_RE.test(skillId)) {
      throw new AppError("Invalid skill id.", 400);
    }

    if (kind === "text") {
      const removed = await customizeRepo.archiveInstructionProfile(
        user.id,
        skillId,
      );
      if (!removed) throw notFound("Skill not found.");
      return jsonData({ ok: true });
    }

    const removed = await userSkillsRepo.softDeleteUserSkill(user.id, skillId);
    if (!removed) throw notFound("Skill not found.");

    if (removed.primary_object_key) {
      try {
        await deleteObject(
          "skills",
          removed.primary_object_key,
          removed.storage_bucket,
        );
      } catch {
        /* best effort */
      }
    }

    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
