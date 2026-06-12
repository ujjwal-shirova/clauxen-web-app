import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response"; // uniform JSON success envelope { data: ... }
import { requireSession } from "@/backend/auth/require-session";
import * as projectsRepo from "@/backend/repositories/projects.repository"; // projects table — get/update/soft-delete SQL
import { AppError, notFound } from "@/backend/db/errors";

const PROJECT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_PROJECT_NAME_LENGTH = 200;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
const MAX_PROJECT_COLOR_LENGTH = 32;

function assertValidProjectId(projectId: string) {
  if (!PROJECT_ID_RE.test(projectId)) {
    throw new AppError("Invalid project id.", 400, "bad_request");
  }
}

function parseProjectPatch(body: unknown): {
  name?: string;
  description?: string;
  color?: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Invalid JSON body.", 400);
  }
  const raw = body as Record<string, unknown>;
  const patch: { name?: string; description?: string; color?: string } = {};
  if ("name" in raw) {
    if (typeof raw.name !== "string")
      throw new AppError("Invalid project name.", 400);
    const name = raw.name.trim();
    if (!name) throw new AppError("Project name cannot be empty.", 400);
    if (name.length > MAX_PROJECT_NAME_LENGTH) {
      throw new AppError("Project name is too long.", 400);
    }
    patch.name = name;
  }
  if ("description" in raw) {
    if (typeof raw.description !== "string") {
      throw new AppError("Invalid project description.", 400);
    }
    const description = raw.description.trim();
    if (description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      throw new AppError("Project description is too long.", 400);
    }
    patch.description = description;
  }
  if ("color" in raw) {
    if (typeof raw.color !== "string")
      throw new AppError("Invalid project color.", 400);
    const color = raw.color.trim();
    if (color.length > MAX_PROJECT_COLOR_LENGTH) {
      throw new AppError("Project color is too long.", 400);
    }
    patch.color = color;
  }
  if (!("name" in patch) && !("description" in patch) && !("color" in patch)) {
    throw new AppError("No valid fields to update.", 400);
  }
  return patch;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // user-specific project data — build-time cache disable

export const GET = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    // session null check — cookie/OAuth session mandatory; fail fast before DB round-trip
    const user = requireSession(session);
    assertValidProjectId(params.projectId);
    const project = await projectsRepo.getProject(params.projectId, user.id);
    if (!project) throw notFound("Project not found.");
    return jsonData({ project });
  },
  { requireAuth: true },
);

// PATCH — project metadata partial update (name, description, color)
export const PATCH = withApiRouteParams<{ projectId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    assertValidProjectId(params.projectId);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const patch = parseProjectPatch(body);
    // updateProject — coalesce patch; owner scope; returning updated row
    const project = await projectsRepo.updateProject(
      params.projectId,
      user.id,
      patch,
    );
    if (!project) throw notFound("Project not found.");
    return jsonData({ project });
  },
  { requireAuth: true },
);

// DELETE — soft delete: status='deleted', row physically retain
export const DELETE = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    // session enforce — anonymous delete forbidden
    const user = requireSession(session);
    assertValidProjectId(params.projectId);
    const deleted = await projectsRepo.deleteProject(params.projectId, user.id);
    if (!deleted) throw notFound("Project not found.");
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
