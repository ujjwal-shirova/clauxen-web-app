import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { notFound } from "@/server/db/errors";
import * as projectsRepo from "@/server/repositories/projects.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ projectId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const row = await projectsRepo.getProject(params.projectId, user.id);
    if (!row) throw notFound("Project not found.");
    const [chats, sources] = await Promise.all([
      projectsRepo.listProjectChats(row.id, user.id),
      projectsRepo.listProjectSources(row.id, user.id),
    ]);
    return jsonData({
      project: {
        ...projectsRepo.mapProject(row),
        chats: chats.map((chat) => ({
          id: chat.id,
          title: chat.title || "New chat",
          preview: chat.preview || "",
          pinned: chat.starred,
          updatedAt: chat.updated_at,
        })),
        sources: sources.map((source) => ({
          id: source.id,
          name: source.original_name,
          kind:
            typeof source.metadata?.kind === "string"
              ? source.metadata.kind
              : "file",
          size: Number(source.size_bytes) || 0,
          createdAt: source.created_at,
        })),
      },
    });
  },
  { requireAuth: true },
);

export const PATCH = withApiRouteParams<{ projectId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      iconId?: string;
      color?: string;
      instructions?: string;
      memory?: "default" | "project";
      libraryAccess?: "enabled" | "disabled";
      pinned?: boolean;
    };
    const row = await projectsRepo.updateProject(params.projectId, user.id, {
      name: typeof body.name === "string" ? body.name.trim().slice(0, 120) : undefined,
      iconId: body.iconId,
      color: body.color && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : undefined,
      instructions:
        typeof body.instructions === "string"
          ? body.instructions.slice(0, 8000)
          : undefined,
      memory: body.memory,
      libraryAccess: body.libraryAccess,
      pinned: body.pinned,
    });
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
