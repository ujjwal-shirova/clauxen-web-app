import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { notFound } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";
import {
  mapProjectChat,
  mapProjectNote,
  mapProjectSource,
  parseProjectPatch,
  type ProjectBody,
} from "@/server/projects/project-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const row = await projectsRepo.getProject(params.projectId, user.id);
    if (!row) throw notFound("Project not found.");

    const [chats, sources, notes] = await Promise.all([
      projectsRepo.listProjectChats(row.id, user.id),
      projectsRepo.listProjectSources(row.id, user.id),
      projectsRepo.listProjectNotes(row.id, user.id),
    ]);

    return jsonData({
      project: {
        ...projectsRepo.mapProject(row),
        chatCount: chats.length,
        sourceCount: sources.length,
        chats: chats.map(mapProjectChat),
        sources: sources.map(mapProjectSource),
        notes: notes.map(mapProjectNote),
      },
    });
  },
  { requireAuth: true },
);

export const PATCH = withApiRouteParams<{ projectId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as ProjectBody;
    const row = await projectsRepo.updateProject(
      params.projectId,
      user.id,
      parseProjectPatch(body),
    );
    if (!row) throw notFound("Project not found.");
    return jsonData({ project: projectsRepo.mapProject(row) });
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const row = await projectsRepo.deleteProject(params.projectId, user.id);
    if (!row) throw notFound("Project not found.");
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
