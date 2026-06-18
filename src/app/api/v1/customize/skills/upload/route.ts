import { randomUUID } from "node:crypto";
import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { AppError } from "@/backend/db/errors";
import * as userSkillsRepo from "@/backend/repositories/user-skills.repository";
import {
  bucketForPurpose,
  buildSkillObjectKey,
  buildSkillPrefix,
  putObject,
} from "@/backend/storage/object-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SKILL_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".zip", ".skill", ".md"]);

function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function parseYamlFrontmatter(text: string): { name?: string; description?: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1]!;
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("file is required.", 400);
    }

    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new AppError("Unsupported file type. Use .zip, .skill, or .md.", 400);
    }
    if (file.size > MAX_SKILL_BYTES) {
      throw new AppError("Skill file exceeds 25 MB limit.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const skillId = randomUUID();
    const bucket = bucketForPurpose("skills");
    const prefix = buildSkillPrefix(user.id, skillId);
    const objectKey = buildSkillObjectKey(user.id, skillId, file.name);

    let name =
      typeof formData.get("name") === "string"
        ? String(formData.get("name")).trim()
        : "";
    let description =
      typeof formData.get("description") === "string"
        ? String(formData.get("description")).trim()
        : "";

    if (ext === ".md") {
      const text = buffer.toString("utf8");
      const meta = parseYamlFrontmatter(text);
      if (!name && meta.name) name = meta.name;
      if (!description && meta.description) description = meta.description;
    }

    if (!name) {
      name = file.name.replace(/\.(zip|skill|md)$/i, "") || "Custom skill";
    }

    await putObject({
      purpose: "skills",
      key: objectKey,
      body: buffer,
      contentType: file.type || undefined,
      metadata: {
        userId: user.id,
        skillId,
        skillName: name.slice(0, 200),
      },
    });

    const skill = await userSkillsRepo.createUserSkill({
      userId: user.id,
      name,
      description,
      storageBucket: bucket,
      storagePrefix: prefix,
      sourceFormat: ext.replace(/^\./, ""),
      primaryObjectKey: objectKey,
    });

    if (!skill) throw new AppError("Failed to save skill metadata.", 500);
    return jsonData({ skill }, 201);
  },
  { requireAuth: true },
);
