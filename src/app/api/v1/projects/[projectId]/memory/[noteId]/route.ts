import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError, notFound } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";
import { PROJECT_NOTE_MAX, mapProjectNote } from "@/server/projects/project-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { projectId: string; noteId: string };

export const PATCH = withApiRouteParams<Params>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      body?: unknown;
      pinned?: unknown;
    };

    const summary =
      typeof body.body === "string"
        ? body.body.trim().slice(0, PROJECT_NOTE_MAX)
        : undefined;
    if (body.body !== undefined && !summary) {
      throw new AppError("Memory note cannot be empty.", 400);
    }

    const row = await projectsRepo.updateProjectNote({
      projectId: params.projectId,
      noteId: params.noteId,
      userId: user.id,
      summary,
      pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
    });
    if (!row) throw notFound("Memory note not found.");
    return jsonData({ note: mapProjectNote(row) });
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<Params>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const row = await projectsRepo.deleteProjectNote({
      projectId: params.projectId,
      noteId: params.noteId,
      userId: user.id,
    });
    if (!row) throw notFound("Memory note not found.");
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
