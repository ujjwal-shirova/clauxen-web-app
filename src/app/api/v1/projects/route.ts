// GET: active projects newest-first; POST: name required, optional description/color
// =============================================================================

import { withApiHandler } from "@/backend/http/api-handler"; // static path handler — session/request inject
import { jsonData } from "@/backend/http/api-response"; // JSON { data } wrapper; POST 201 status support
import { requireSession } from "@/backend/auth/require-session"; // null session → 401 unauthorized
import * as projectsRepo from "@/backend/repositories/projects.repository"; // listProjects / createProject SQL
import { AppError } from "@/backend/db/errors"; // validation errors — 400 bad request factory

const MAX_PROJECT_NAME_LENGTH = 200;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
const PROJECT_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

export const runtime = "nodejs"; // DB pool access — Node.js runtime required
export const dynamic = "force-dynamic"; // per-user project list — no static caching

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    // listProjects — where user_id=$1 and status='active' order by updated_at desc
    const projects = await projectsRepo.listProjects(user.id);
    return jsonData({ projects });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: { name?: string; description?: string; color?: string };
    try {
      body = (await request.json()) as {
        name?: string;
        description?: string;
        color?: string;
      };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new AppError("Project name is required.", 400);
    if (name.length > MAX_PROJECT_NAME_LENGTH) {
      throw new AppError("Project name is too long.", 400);
    }
    let description: string | undefined;
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== "string") {
        throw new AppError("Invalid description.", 400);
      }
      const trimmed = body.description.trim();
      if (trimmed.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
        throw new AppError("Description is too long.", 400);
      }
      description = trimmed || undefined;
    }
    let color: string | undefined;
    if (body.color !== undefined && body.color !== null) {
      if (
        typeof body.color !== "string" ||
        !PROJECT_COLOR_HEX.test(body.color)
      ) {
        throw new AppError("Invalid project color.", 400);
      }
      color = body.color;
    }
    // createProject — insert returning full row; workspace_id default null
    const project = await projectsRepo.createProject({
      userId: user.id,
      name, // leading/trailing spaces strip — display consistency
      description,
      color,
    });
    return jsonData({ project }, 201);
  },
  { requireAuth: true },
);
