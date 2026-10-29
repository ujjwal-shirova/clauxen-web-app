import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError, notFound } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";
import { PROJECT_NOTE_MAX, mapProjectNote } from "@/server/projects/project-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const notes = await projectsRepo.listProjectNotes(params.projectId, user.id);
    return jsonData({ notes: notes.map(mapProjectNote) });
  },
  { requireAuth: true },
);

export const POST = withApiRouteParams<{ projectId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as { body?: unknown };
    const summary =
      typeof body.body === "string"
        ? body.body.trim().slice(0, PROJECT_NOTE_MAX)
        : "";
    if (!summary) throw new AppError("Memory note cannot be empty.", 400);

    const row = await projectsRepo.createProjectNote({
      projectId: params.projectId,
      userId: user.id,
      summary,
    });
    if (!row) throw notFound("Project not found.");
    return jsonData({ note: mapProjectNote(row) }, 201);
  },
  { requireAuth: true },
);
