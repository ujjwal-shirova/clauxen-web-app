// GET: active projects newest-first; POST: name required, optional description/color
// =============================================================================

import { withApiHandler } from "@/server/http/api-handler"; // static path handler — session/request inject
import { jsonData } from "@/server/http/api-response"; // JSON { data } wrapper; POST 201 status support
import { requireSession } from "@/server/auth/require-session"; // null session → 401 unauthorized
import * as projectsRepo from "@/server/repositories/projects.repository"; // listProjects / createProject SQL
import { AppError } from "@/server/db/errors"; // validation errors — 400 bad request factory

const MAX_PROJECT_NAME_LENGTH = 200;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
const PROJECT_COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_PROJECT_ICON_LENGTH = 16;

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
    let body: {
      id?: string;
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
    };
    try {
      body = (await request.json()) as {
        id?: string;
        name?: string;
        description?: string;
        color?: string;
        icon?: string;
      };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const PROJECT_ID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const requestedId =
      typeof body.id === "string" && PROJECT_ID.test(body.id.trim())
        ? body.id.trim()
        : undefined;
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
    let icon: string | undefined;
    if (body.icon !== undefined && body.icon !== null) {
      if (
        typeof body.icon !== "string" ||
        body.icon.trim().length > MAX_PROJECT_ICON_LENGTH
      ) {
        throw new AppError("Invalid project icon.", 400);
      }
      icon = body.icon.trim() || undefined;
    }
    // createProject — insert returning full row; workspace_id default null
    const project = await projectsRepo.createProject({
      userId: user.id,
      id: requestedId,
      name, // leading/trailing spaces strip — display consistency
      description,
      color,
      icon,
    });
    return jsonData({ project }, 201);
  },
  { requireAuth: true },
);
